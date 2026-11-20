import { AsyncLocalStorage } from "node:async_hooks";
import { AwsClient } from "aws4fetch";

const workerBindings = new AsyncLocalStorage<{
  env: Cloudflare.Env;
  origin: string;
}>();

export function withWorkerStorage<T>(
  env: Cloudflare.Env,
  request: Request,
  run: () => T,
): T {
  return workerBindings.run({ env, origin: new URL(request.url).origin }, run);
}

export const workerOrigin = () => workerBindings.getStore()?.origin;

export function runtimeSetting(name: string) {
  const bindings = workerBindings.getStore()?.env as
    Record<string, unknown> | undefined;
  const value = bindings ? bindings[name] : process.env[name];
  return typeof value === "string" ? value : undefined;
}

export const mediaUploadLimit = () =>
  workerBindings.getStore() ? 5_000_000 : 4_000_000;
export function clientAddress(request: Request) {
  if (workerBindings.getStore())
    return request.headers.get("cf-connecting-ip") ?? "local";
  return process.env.VERCEL === "1"
    ? (request.headers.get("x-vercel-forwarded-for") ?? "unknown")
    : "local";
}

export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  if (workerBindings.getStore()) return url.origin;
  const host = request.headers.get("host");
  if (!host || !/^[a-z0-9.\-:\[\]]+$/i.test(host)) return url.origin;
  const protocol = process.env.VERCEL === "1" ? "https:" : url.protocol;
  return `${protocol}//${host}`;
}

type SqlValue = string | number | null;
type QueryResult<T> = {
  success: boolean;
  results: T[];
  meta: { changes: number };
};

class Statement {
  constructor(
    private readonly db: RemoteDatabase,
    readonly sql: string,
    readonly params: SqlValue[] = [],
  ) {}

  bind(...params: SqlValue[]) {
    return new Statement(this.db, this.sql, params);
  }

  first<T = Record<string, unknown>>(): Promise<T | null>;
  first<T = unknown>(column: string): Promise<T | null>;
  async first(column?: string) {
    const row = (await this.all()).results[0];
    return (column === undefined ? row : row?.[column]) ?? null;
  }

  all<T = Record<string, unknown>>() {
    return this.run<T>();
  }

  async run<T = Record<string, unknown>>() {
    return (await this.db.batch<T>([this]))[0];
  }
}

abstract class RemoteDatabase {
  prepare(sql: string) {
    return new Statement(this, sql);
  }

  abstract batch<T = Record<string, unknown>>(
    statements: Statement[],
  ): Promise<QueryResult<T>[]>;
}

class CloudflareDatabase extends RemoteDatabase {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {
    super();
  }

  async batch<T = Record<string, unknown>>(statements: Statement[]) {
    const response = await fetch(this.url, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batch: statements.map(({ sql, params }) => ({
          sql,
          params: params.map((value) =>
            value === null ? null : String(value),
          ),
        })),
      }),
    });
    if (!response.ok)
      throw new Error(`Database request failed (${response.status})`);
    const data = (await response.json()) as {
      success: boolean;
      result: QueryResult<T>[];
    };
    if (
      !data.success ||
      data.result?.length !== statements.length ||
      data.result.some((result) => !result.success)
    )
      throw new Error("Database query failed");
    return data.result;
  }
}

async function openPostgres(connection: string) {
  const { default: postgres } = await import("postgres");
  return postgres(connection, {
    ssl: { rejectUnauthorized: true },
    prepare: false,
    max: 2,
    max_pipeline: 1,
    connect_timeout: 10,
    idle_timeout: 20,
    fetch_types: false,
    types: {
      epoch: { to: 20, from: [20], parse: Number, serialize: String },
    },
  });
}

let postgresPool: ReturnType<typeof openPostgres> | undefined;
class PostgresDatabase extends RemoteDatabase {
  constructor(private readonly connection: string) {
    super();
  }

  async batch<T = Record<string, unknown>>(statements: Statement[]) {
    const postgres = await (postgresPool ??= openPostgres(this.connection));
    return postgres.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL search_path TO cci, pg_catalog");
      const results: QueryResult<T>[] = [];
      for (const { sql, params } of statements) {
        // The publish audit runs only when the preceding optimistic update changed a row.
        const changeGuard = " WHERE changes() > 0";
        const guarded = sql.endsWith(changeGuard);
        if (guarded && !results.at(-1)?.meta.changes) {
          results.push({ success: true, results: [], meta: { changes: 0 } });
          continue;
        }
        let index = 0;
        const query = (
          guarded ? sql.slice(0, -changeGuard.length) : sql
        ).replace(/\?/g, () => `$${++index}`);
        const rows = await transaction.unsafe(query, params);
        results.push({
          success: true,
          results: [...rows] as T[],
          meta: { changes: rows.count ?? 0 },
        });
      }
      return results;
    });
  }
}

function usesSupabase() {
  return Boolean(
    runtimeSetting("POSTGRES_URL") ||
    runtimeSetting("SUPABASE_URL") ||
    runtimeSetting("SUPABASE_SECRET_KEY"),
  );
}

export function database(): Pick<RemoteDatabase, "prepare" | "batch"> {
  const bindings = workerBindings.getStore()?.env;
  if (bindings) {
    if (!bindings.DB) throw new Error("Database unavailable");
    return bindings.DB as unknown as Pick<RemoteDatabase, "prepare" | "batch">;
  }
  if (usesSupabase()) {
    const connection = runtimeSetting("POSTGRES_URL");
    if (!connection) throw new Error("Supabase database unavailable");
    return new PostgresDatabase(connection);
  }
  const account = runtimeSetting("CLOUDFLARE_ACCOUNT_ID");
  const id = runtimeSetting("CCI_D1_DATABASE_ID");
  const token = runtimeSetting("CLOUDFLARE_D1_API_TOKEN");
  if (!account || !id || !token) throw new Error("Database unavailable");
  return new CloudflareDatabase(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(id)}/query`,
    token,
  );
}

function supabaseMediaStore() {
  const url = runtimeSetting("SUPABASE_URL");
  const key = runtimeSetting("SUPABASE_SECRET_KEY");
  if (!url || !key || new URL(url).protocol !== "https:") return undefined;
  const bucket = import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }).storage.from("cci-media"),
  );
  return {
    async get(id: string) {
      const { data, error } = await (await bucket).download(id);
      if (error && "statusCode" in error && String(error.statusCode) === "404")
        return null;
      if (error) throw new Error("Media lookup failed");
      return new Response(data);
    },
    async put(id: string, bytes: Uint8Array<ArrayBuffer>, contentType: string) {
      const { error } = await (await bucket).upload(id, bytes, { contentType });
      if (error) throw new Error("Media upload failed");
    },
    async delete(id: string) {
      const { error } = await (await bucket).remove([id]);
      if (error) throw new Error("Media deletion failed");
    },
  };
}

export function mediaStore() {
  const bindings = workerBindings.getStore()?.env;
  if (bindings) {
    const bucket = bindings.BUCKET;
    return (
      bucket && {
        get: (key: string) => bucket.get(key),
        put: (
          key: string,
          bytes: Uint8Array<ArrayBuffer>,
          contentType: string,
        ) => bucket.put(key, bytes, { httpMetadata: { contentType } }),
        delete: (key: string) => bucket.delete(key),
      }
    );
  }
  if (usesSupabase()) return supabaseMediaStore();
  const account = runtimeSetting("CLOUDFLARE_ACCOUNT_ID");
  const bucket = runtimeSetting("CCI_R2_BUCKET");
  const accessKeyId = runtimeSetting("CCI_R2_ACCESS_KEY_ID");
  const secretAccessKey = runtimeSetting("CCI_R2_SECRET_ACCESS_KEY");
  if (
    !account ||
    !/^[a-f0-9]{32}$/i.test(account) ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey
  )
    return undefined;

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 1,
  });
  const url = (key: string) =>
    `https://${account}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
  return {
    async get(key: string) {
      const response = await client.fetch(url(key), { cache: "no-store" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Media lookup failed");
      return response;
    },
    async put(
      key: string,
      bytes: Uint8Array<ArrayBuffer>,
      contentType: string,
    ) {
      const response = await client.fetch(url(key), {
        method: "PUT",
        body: bytes,
        headers: { "Content-Type": contentType },
      });
      if (!response.ok) throw new Error("Media upload failed");
    },
    async delete(key: string) {
      const response = await client.fetch(url(key), { method: "DELETE" });
      if (!response.ok) throw new Error("Media deletion failed");
    },
  };
}
