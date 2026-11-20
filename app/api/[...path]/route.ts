import { clientAddress, mediaStore, mediaUploadLimit, requestOrigin } from "../../../lib/runtime-storage";
import { textFor } from "../../../lib/content";
import {
  lockStaffPortal,
  saveStaffAccess,
  unlockStaffPortal,
} from "../../../lib/staff-auth";
import { portalCookie } from "../../../lib/staff-password";
import {
  authorize,
  database,
  seed,
  identity,
  isConfiguredAdministrator,
  publicContent,
  HttpError,
  rateLimit,
  auditStatement,
  validateContent,
} from "../../../lib/server";
export const dynamic = "force-dynamic";
const json = (data: any, status = 200, cookie?: string) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
async function handle(req: Request, { params }: any) {
  try {
    const { path } = await params;
    const key = path.join("/");
    const db = database();
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin !== requestOrigin(req))
        throw new HttpError(403, "Invalid request origin.");
      if (Number(req.headers.get("content-length") || 0) > 5500000)
        throw new HttpError(413, "File is too large.");
    }
    await seed();
    if (key === "public" && req.method === "GET")
      return json(await publicContent());
    if (key === "session" && req.method === "GET")
      return json(await identity());
    if (key === "staff/unlock" && req.method === "POST") {
      const result = await unlockStaffPortal(req);
      return result.token
        ? json({ unlocked: true }, 200, portalCookie(result.token))
        : json({ setupRequired: true });
    }
    if (key === "staff/lock" && req.method === "POST") {
      await lockStaffPortal(req);
      return json({ ok: true }, 200, portalCookie());
    }
    if (path[0] === "media-file" && req.method === "GET") {
      const item: any = await db
        .prepare("SELECT * FROM media WHERE id=?")
        .bind(path[1])
        .first();
      if (!item) throw new HttpError(404, "Image not found.");
      const imageUrl = `/api/media-file/${item.id}`;
      const published = await publicContent();
      const used = published.some(
        (c) =>
          c.image === imageUrl ||
          c.cardImage === imageUrl ||
          c.sections.some((s) => s.image === imageUrl),
      );
      if (!used) await authorize("media");
      const file = await mediaStore()?.get(item.id);
      if (!file) throw new HttpError(404, "Image not found.");
      return new Response(file.body, {
        headers: {
          "Content-Type": item.type,
          "Cache-Control": used ? "private, max-age=300" : "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (
      (key === "contact" || key === "contact-test") &&
      req.method === "POST"
    ) {
      const isTest = key === "contact-test";
      const body = (await req.json()) as any;
      let confirmation = "";
      if (isTest) {
        const staff = await authorize("enquiries");
        await rateLimit("contact-test:" + staff.userId, 12, 3600);
      } else {
        const published = await publicContent();
        const settings = published.find((c) => c.id === "site");
        if (
          !settings?.privacyApproved ||
          !published.some((c) => c.id === "privacy")
        )
          throw new HttpError(409, "Online enquiries are temporarily paused.");
        confirmation = textFor(settings.contactConfirmation, body.language);
        const source = clientAddress(req);
        await rateLimit("contact:" + source, 5, 3600);
      }
      if (body.website)
        throw new HttpError(400, "Unable to send this enquiry.");
      for (const [field, max] of Object.entries({
        name: 100,
        email: 254,
        subject: 200,
        message: 5000,
      }))
        if (
          typeof body[field] !== "string" ||
          !body[field].trim() ||
          body[field].length > max
        )
          throw new HttpError(
            400,
            "Please complete all fields within the displayed limits.",
          );
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
        body.consent !== true
      )
        throw new HttpError(
          400,
          isTest
            ? "Enter a valid example email and confirm you are using test data."
            : "Enter a valid email and agree to the privacy notice.",
        );
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO enquiries(id,name,email,subject,message,status,notes,created_at) VALUES (?,?,?,?,?,'New','',?)",
        )
        .bind(
          id,
          body.name.trim(),
          body.email.trim(),
          (isTest ? "[TEST] " : "") + body.subject.trim(),
          body.message.trim(),
          new Date().toISOString(),
        )
        .run();
      return json(
        {
          id,
          message: isTest
            ? "Test enquiry received. Find it under Enquiries in the admin portal."
            : confirmation ||
              "Your message has been received. Thank you for connecting with CCI.",
        },
        201,
      );
    }
    if (key === "content" && req.method === "GET") {
      await authorize("read");
      return json(
        (
          await db.prepare("SELECT * FROM content ORDER BY kind,id").all()
        ).results.map((r: any) => ({
          ...r,
          draft: JSON.parse(r.draft),
          published: r.published ? JSON.parse(r.published) : null,
        })),
      );
    }
    if (key === "content" && req.method === "POST") {
      const user = await authorize("edit");
      const b = (await req.json()) as any;
      const c = validateContent(b.content);
      if (c.kind === "settings") await authorize("settings");
      const old: any = await db
        .prepare("SELECT * FROM content WHERE id=?")
        .bind(c.id)
        .first();
      if (old && old.kind !== c.kind)
        throw new HttpError(400, "Content type cannot be changed.");
      if (old && old.version !== b.version)
        throw new HttpError(
          409,
          "This record changed in another session. Reload before saving.",
        );
      let stmt;
      if (old)
        stmt = db
          .prepare(
            "UPDATE content SET draft=?,version=version+1,updated_at=? WHERE id=? AND version=?",
          )
          .bind(JSON.stringify(c), new Date().toISOString(), c.id, b.version);
      else
        stmt = db
          .prepare(
            "INSERT INTO content(id,kind,draft,published,version,updated_at) VALUES (?,?,?,NULL,1,?)",
          )
          .bind(c.id, c.kind, JSON.stringify(c), new Date().toISOString());
      const results = await db.batch([
        stmt,
        auditStatement(user.email, "Save draft", c.id),
      ]);
      if (!results[0].meta.changes)
        throw new HttpError(409, "Content has changed. Reload and try again.");
      return json({ ok: true });
    }
    if (key === "publish" && req.method === "POST") {
      const user = await authorize("publish");
      const b = (await req.json()) as any;
      const row: any = await db
        .prepare("SELECT * FROM content WHERE id=?")
        .bind(b.id)
        .first();
      if (!row) throw new HttpError(404, "Record not found.");
      if (row.kind === "settings") await authorize("settings");
      if (row.version !== b.version)
        throw new HttpError(409, "Reload this record before publishing.");
      if (b.unpublish && row.kind === "settings")
        throw new HttpError(
          400,
          "Website settings cannot be unpublished. Publish updated settings instead.",
        );
      let draft = row.draft;
      let published = row.published;
      const statusOnly = b.status !== undefined;
      if (statusOnly) {
        if (
          row.kind !== "initiative" ||
          b.unpublish ||
          b.content !== undefined ||
          !["Active", "Coming Soon"].includes(b.status)
        )
          throw new HttpError(
            400,
            "Choose Active or Coming Soon for an initiative.",
          );
        // Keep draft and public snapshots separate. Changing a status must
        // never publish other pending edits or make an unpublished entry live.
        draft = JSON.stringify({ ...JSON.parse(draft), status: b.status });
        if (published)
          published = JSON.stringify({
            ...JSON.parse(published),
            status: b.status,
          });
      } else if (b.content !== undefined) {
        if (b.unpublish)
          throw new HttpError(400, "Unpublish does not accept content edits.");
        await authorize("edit");
        const submitted = validateContent(b.content);
        if (submitted.id !== row.id || submitted.kind !== row.kind)
          throw new HttpError(400, "Content identity cannot be changed.");
        draft = JSON.stringify(submitted);
      } else if (!b.unpublish) {
        validateContent(JSON.parse(draft));
      }
      if (!statusOnly) published = b.unpublish ? null : draft;
      const now = new Date().toISOString();
      const [result] = await db.batch([
        db
          .prepare(
            "UPDATE content SET draft=?,published=?,version=version+1,updated_at=? WHERE id=? AND version=?",
          )
          .bind(draft, published, now, b.id, b.version),
        // Log only a committed version transition.
        db
          .prepare(
            "INSERT INTO audit (id,actor,action,target,created_at) SELECT ?,?,?,?,? WHERE changes() > 0",
          )
          .bind(
            crypto.randomUUID(),
            user.email,
            statusOnly
              ? "Update initiative status"
              : b.unpublish
                ? "Unpublish"
                : "Publish",
            b.id,
            now,
          ),
      ]);
      if (!result.meta.changes)
        throw new HttpError(409, "Reload this record before publishing.");
      return json({ ok: true });
    }
    if (key === "media" && req.method === "GET") {
      await authorize("media");
      return json(
        (await db.prepare("SELECT * FROM media ORDER BY created_at DESC").all())
          .results,
      );
    }
    if (key === "media" && req.method === "POST") {
      const user = await authorize("media");
      const storage = mediaStore();
      if (!storage)
        throw new HttpError(503, "Media storage is unavailable.");
      const form = await req.formData();
      const file = form.get("file");
      const alt = String(form.get("alt") || "").trim();
      const uploadLimit = mediaUploadLimit();
      if (!file || typeof file === "string" || !alt || alt.length > 500 || file.size > uploadLimit)
        throw new HttpError(
          400,
          `Choose an image under ${uploadLimit / 1_000_000} MB and provide alternative text.`,
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      const png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71;
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp =
        new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      const type = png
        ? "image/png"
        : jpg
          ? "image/jpeg"
          : webp
            ? "image/webp"
            : "";
      if (!type || type !== file.type)
        throw new HttpError(
          400,
          "Only valid PNG, JPEG and WebP images are accepted.",
        );
      const id = crypto.randomUUID();
      await storage.put(id, bytes, type);
      await db.batch([
        db
          .prepare(
            "INSERT INTO media(id,name,type,size,alt,created_at) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            id,
            file.name.slice(0, 200),
            type,
            file.size,
            alt,
            new Date().toISOString(),
          ),
        auditStatement(user.email, "Upload image", id),
      ]);
      return json({ id }, 201);
    }
    if (key === "media" && req.method === "DELETE") {
      const user = await authorize("media");
      const { id } = (await req.json()) as any;
      const rows = (
        await db.prepare("SELECT draft,published FROM content").all()
      ).results;
      const target = `/api/media-file/${id}`;
      if (
        rows.some(
          (r: any) => r.draft.includes(target) || r.published?.includes(target),
        )
      )
        throw new HttpError(
          409,
          "This image is used by content. Remove its references before deleting.",
        );
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id))
        throw new HttpError(400, "Invalid image ID.");
      const storage = mediaStore();
      if (!storage) throw new HttpError(503, "Media storage is unavailable.");
      await storage.delete(id);
      await db.batch([
        db.prepare("DELETE FROM media WHERE id=?").bind(id),
        auditStatement(user.email, "Delete image", id),
      ]);
      return json({ ok: true });
    }
    if (key === "enquiries/count" && req.method === "GET") {
      await authorize("enquiries");
      const count = await db
        .prepare("SELECT COUNT(*) AS count FROM enquiries WHERE status = 'New'")
        .first<number>("count");
      return json({ count: count ?? 0 });
    }
    if (key === "enquiries" && req.method === "GET") {
      await authorize("enquiries");
      return json(
        (
          await db
            .prepare(
              "SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 500",
            )
            .all()
        ).results,
      );
    }
    if (key === "enquiries" && req.method === "POST") {
      const user = await authorize("enquiries");
      const b = (await req.json()) as any;
      if (
        !["New", "In Review", "Responded", "Closed"].includes(b.status) ||
        typeof b.notes !== "string" ||
        b.notes.length > 5000
      )
        throw new HttpError(400, "Invalid enquiry update.");
      await db.batch([
        db
          .prepare("UPDATE enquiries SET status=?,notes=? WHERE id=?")
          .bind(b.status, b.notes, b.id),
        auditStatement(user.email, "Update enquiry", b.id),
      ]);
      return json({ ok: true });
    }
    if (key === "staff" && req.method === "GET") {
      await authorize("users");
      return json(
        (
          await db
            .prepare(
              `SELECT staff.email, role, active,
        staff_credentials.email IS NOT NULL AS has_password
        FROM staff LEFT JOIN staff_credentials USING(email) ORDER BY staff.email`,
            )
            .all<{ email: string; role: string; active: number; has_password: number }>()
        ).results.map((item) => ({ ...item, managed: isConfiguredAdministrator(item.email) })),
      );
    }
    if (key === "staff" && req.method === "POST")
      return json(await saveStaffAccess(req));
    if (key === "audit" && req.method === "GET") {
      await authorize("audit");
      return json(
        (
          await db
            .prepare("SELECT * FROM audit ORDER BY created_at DESC LIMIT 200")
            .all()
        ).results,
      );
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(
      "CCI API operation failed",
      e instanceof Error ? e.name : "Error",
    );
    return json(
      { error: "Unable to complete this request. Please try again." },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
