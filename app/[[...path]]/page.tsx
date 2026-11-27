import { publicContent, database, identity, siteOrigin } from "../../lib/server";
import Website from "../../components/Website";
import Admin from "../../components/Admin";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { textFor } from "../../lib/content";
import { staffRecoveryMode } from "../../lib/staff-auth";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
  searchParams,
}: any): Promise<Metadata> {
  const { path = [] } = await params;
  if (path[0] === "admin") {
    return { title: "CCI Staff Portal", robots: { index: false, follow: false } };
  }
  const lang = path[0] === "my" ? "my" : "en";
  const rest = ["en", "my"].includes(path[0]) ? path.slice(1) : path;
  const data = await publicContent();
  const id = rest.at(-1) || "home";
  const page = data.find((c) => c.id === id);
  const suffix = rest.join("/");
  const settings = data.find((c) => c.id === "site");
  const siteName = textFor(settings?.title, lang) || "Click Cross Initiative";
  const origin = siteOrigin();
  const query = await searchParams;
  const preview =
    data.find((c) => c.id === "site")?.preview ||
    query?.preview ||
    query?.test === "1";
  const title =
    textFor(page?.seoTitle, lang) ||
    textFor(settings?.seoTitle, lang) ||
    textFor(page?.title, lang);
  const description =
    textFor(page?.seoDescription, lang) ||
    textFor(settings?.seoDescription, lang) ||
    textFor(page?.description, lang) ||
    textFor(settings?.description, lang);
  return {
    title: title ? `${title} | ${siteName}` : siteName,
    description,
    alternates: {
      canonical: `${origin}/${lang}${suffix ? "/" + suffix : ""}`,
      languages: {
        en: `${origin}/en${suffix ? "/" + suffix : ""}`,
        my: `${origin}/my${suffix ? "/" + suffix : ""}`,
      },
    },
    openGraph: { title: title || siteName, description },
    robots:
      preview
        ? { index: false, follow: false }
        : undefined,
  };
}
export default async function Page({ params, searchParams }: any) {
  const { path = [] } = await params;
  if (path[0] === "admin") {
    if (path.length > 1) notFound();
    return <Admin recoveryMode={staffRecoveryMode()} />;
  }
  const rest = ["en", "my"].includes(path[0]) ? path.slice(1) : path;
  let data = await publicContent();
  const query = await searchParams;
  const preview = Boolean(query?.preview);
  const contactTest =
    rest.length === 1 && rest[0] === "contact" && query?.test === "1";
  if (contactTest) {
    const user = await identity();
    if (!user?.permissions.includes("enquiries")) redirect("/admin");
  }
  if (preview) {
    const user = await identity();
    if (!user?.permissions.includes("read")) redirect("/admin");
    data = (
      await database().prepare("SELECT draft FROM content").all()
    ).results.map((r: any) => JSON.parse(r.draft));
  }
  const id = rest.at(-1) || "home";
  const record = data.find(
    (c) => c.id === id && (c.kind === "page" || c.kind === "initiative"),
  );
  if (
    !record ||
    rest.length > 2 ||
    (rest.length === 2 &&
      (rest[0] !== "initiatives" || record.kind !== "initiative"))
  )
    notFound();
  return (
    <Website
      content={data}
      route={path}
      preview={preview}
      contactTest={contactTest}
    />
  );
}
