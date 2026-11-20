import { publicContent, siteOrigin } from "../lib/server";

export const dynamic = "force-dynamic";
export default async function robots() {
  const preview = (await publicContent()).find((c) => c.id === "site")?.preview;
  return {
    rules: {
      userAgent: "*",
      allow: preview ? undefined : "/",
      disallow: preview ? "/" : ["/admin", "/api"],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
