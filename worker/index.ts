import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import { withWorkerStorage } from "../lib/runtime-storage";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
  ) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt)
            return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return {
              status: "request_context_expired",
              message: "This request has expired. Please try again.",
            };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response = await withWorkerStorage(env, request, () =>
      runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx)),
    );
    const secure = new Response(response.body, response);
    const url = new URL(request.url);
    const staffPage =
      /^\/(admin|api\/staff)(\/|$)/.test(url.pathname) ||
      url.searchParams.has("preview");
    if (secure.headers.get("Content-Type")?.includes("text/html")) {
      secure.headers.set("Cache-Control", "private, no-store");
    }
    secure.headers.set("X-Content-Type-Options", "nosniff");
    secure.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (staffPage) {
      secure.headers.set("Cache-Control", "private, no-store");
      secure.headers.set("Referrer-Policy", "no-referrer");
      secure.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    secure.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (!import.meta.env.DEV) {
      const frameSources = staffPage
        ? "'self' https://chatgpt.com https://*.chatgpt.com"
        : "'self' https://chatgpt.com https://*.chatgpt.com https://*.chatgpt.site";
      secure.headers.set("Strict-Transport-Security", "max-age=31536000");
      secure.headers.set(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${frameSources}`,
      );
    }
    return secure;
  },
};

export default worker;
