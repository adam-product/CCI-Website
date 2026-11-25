const sharedPoolerHostname = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/;

/**
 * Routes a dedicated Supabase URI through the shared pooler when configured.
 * Postgres.js still obtains the password and database name from the original URI.
 * @param {string} connection
 * @param {string | undefined} poolerHost
 */
export function supabasePoolerOptions(connection, poolerHost) {
  if (!poolerHost) return {};

  let url;
  try {
    url = new URL(connection);
  } catch {
    throw new Error("POSTGRES_URL is not a valid connection URI.");
  }

  if (sharedPoolerHostname.test(url.hostname)) return {};

  const projectRef = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname)?.[1];
  if (!projectRef || !url.username || !sharedPoolerHostname.test(poolerHost)) {
    throw new Error("Expected a dedicated Supabase URI and a shared Supabase pooler hostname.");
  }

  return {
    host: poolerHost,
    port: 6543,
    user: `${url.username}.${projectRef}`,
  };
}
