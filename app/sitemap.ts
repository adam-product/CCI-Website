import { publicContent, siteOrigin } from "../lib/server";

export const dynamic = "force-dynamic";
export default async function sitemap() {
  const content = await publicContent();
  return content
    .filter((c) => c.kind === "page" || c.kind === "initiative")
    .flatMap((c) =>
      ["en", "my"].map((lang) => ({
        url: `${siteOrigin()}/${lang}/${c.kind === "initiative" ? "initiatives/" : ""}${c.id === "home" ? "" : c.id}`,
      })),
    );
}
