"use client";
import { Fragment, useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  Check,
  Globe2,
  ShieldCheck,
  Fingerprint,
  BookOpen,
  MessagesSquare,
  LockKeyhole,
  ChevronDown,
  Mail,
  Plus,
  Users,
  Lightbulb,
  HeartHandshake,
  GraduationCap,
  BriefcaseBusiness,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ChoiceField } from "./ChoiceField";
import { ImpactNumber } from "./ImpactNumber";
import { InitiativeGallery } from "./InitiativeGallery";
import { PublicImage } from "./PublicImage";
import AboutStory from "./AboutStory";
import { useRevealFallback } from "../hooks/use-reveal-fallback";
import { enquiryTypes } from "../lib/enquiry";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
  FaTiktok,
} from "react-icons/fa6";
import {
  Content,
  type Section,
  type SocialChannel,
  socialChannels,
  textFor,
} from "../lib/content";
const socialIcons = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  linkedin: FaLinkedinIn,
  youtube: FaYoutube,
  tiktok: FaTiktok,
};
const focusIcons = [BookOpen, ShieldCheck, Fingerprint, Users, Lightbulb];
const contactOpportunityIcons: Partial<Record<string, LucideIcon>> = {
  volunteer: HeartHandshake,
  trainer: GraduationCap,
  advocate: ShieldCheck,
  "corporate-partners": BriefcaseBusiness,
  "community-partners": Users,
  "academic-partners": BookOpen,
  "media-partners": Megaphone,
};
const contactGroupIds = new Set([
  "individual-contributions",
  "organisational-partnerships",
  "get-in-touch",
]);
const nav = [
  ["", "Home", "ပင်မစာမျက်နှာ"],
  ["initiatives", "Our Initiatives", "ကျွန်ုပ်တို့၏ အစီအစဉ်များ"],
  ["impact", "Impact", "အကျိုးသက်ရောက်မှု"],
  ["about", "About Us", "ကျွန်ုပ်တို့အကြောင်း"],
  ["contact", "Work With Us", "ကျွန်ုပ်တို့နှင့် ပူးပေါင်းရန်"],
];
const editorialHeroes: Partial<
  Record<string, { image: string; alt: string }>
> = {
  initiatives: {
    image: "/brand/c2-02.webp",
    alt: "C2, the red Way Way Shaung mascot, wearing an orange hat",
  },
  impact: {
    image: "/images/learning.webp",
    alt: "Students sharing ideas around a laptop",
  },
  about: {
    image: "/images/community.webp",
    alt: "Friends sitting together by the water with their arms around one another",
  },
};
export default function Website({
  content: initial,
  route,
  preview,
  contactTest,
}: {
  content: Content[];
  route: string[];
  preview: boolean;
  contactTest: boolean;
}) {
  const [content, setContent] = useState(initial);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 36);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const [menu, setMenu] = useState(false);
  const [formState, setFormState] = useState({
    busy: false,
    error: "",
    success: "",
  });
  const lang = route[0] === "my" ? "my" : "en";
  const parts = ["en", "my"].includes(route[0]) ? route.slice(1) : route;
  const pageId = parts.at(-1) || "home";
  useRevealFallback(`${lang}/${pageId}`, content);
  const page = content.find(
    (c) => c.id === pageId && (c.kind === "page" || c.kind === "initiative"),
  );
  const heroDesign = Object.hasOwn(editorialHeroes, pageId)
    ? editorialHeroes[pageId]
    : undefined;
  const overHero =
    page?.kind === "page" &&
    (pageId === "home" || pageId === "contact" || !!heroDesign);
  const settings = content.find((c) => c.id === "site")!;
  const publishedIds = new Set(content.map((record) => record.id));
  const availableNav = nav.filter(([slug]) => publishedIds.has(slug || "home"));
  const acceptsEnquiries =
    contactTest || (!!settings.privacyApproved && publishedIds.has("privacy"));
  const impactPage = content.find((c) => c.id === "impact");
  const initiatives = content
    .filter((c) => c.kind === "initiative")
    .sort((a, b) => a.order - b.order);
  const tr = (v: any) => textFor(v, lang);
  const ui = (en: string, my: string) => (lang === "my" ? my : en);
  const href = (p = "") => `/${lang}${p ? "/" + p : ""}`;
  const contentHref = (url: string) =>
    url.replace(/^\/(?:en|my)(?=\/|$)/, `/${lang}`);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    setContent(initial);
    if (preview) return;
    let pending: AbortController | undefined;
    const refresh = async () => {
      pending?.abort();
      const request = new AbortController();
      pending = request;
      try {
        const response = await fetch("/api/public", {
          cache: "no-store",
          signal: request.signal,
        });
        if (response.ok) {
          const snapshot: Content[] = await response.json();
          if (!request.signal.aborted) setContent(snapshot);
        }
      } catch {
        // Retain the rendered publication until connectivity returns.
      }
    };
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel("cci-publication")
        : null;
    channel?.addEventListener("message", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);
    return () => {
      pending?.abort();
      channel?.close();
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
    };
  }, [initial, preview]);
  useEffect(() => {
    setMenu(false);
  }, [pageId]);
  useEffect(() => {
    const track = document.querySelector<HTMLElement>(".campaign-track");
    if (!track) return;
    const hero = track.querySelector<HTMLElement>(".photo-hero");
    const clouds = track.querySelector<HTMLElement>(".hero-clouds");
    const allowParallax = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const resetClouds = () => {
      clouds?.style.removeProperty("--cloud-x");
      clouds?.style.removeProperty("--cloud-y");
    };
    const moveClouds = (event: PointerEvent) => {
      if (
        !allowParallax.matches ||
        event.pointerType === "touch" ||
        !hero ||
        !clouds
      )
        return;
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      clouds.style.setProperty("--cloud-x", `${(x * 64).toFixed(1)}px`);
      clouds.style.setProperty("--cloud-y", `${(y * 40).toFixed(1)}px`);
    };
    hero?.addEventListener("pointermove", moveClouds, { passive: true });
    hero?.addEventListener("pointerleave", resetClouds);
    allowParallax.addEventListener("change", resetClouds);
    let frame = 0;
    const paint = () => {
      frame = 0;
      const range =
        track.offsetHeight - (track.firstElementChild?.clientHeight || 0);
      const progress =
        range > 0
          ? Math.min(1, Math.max(0, -track.getBoundingClientRect().top / range))
          : 0;
      track.style.setProperty("--turn", String(progress));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      hero?.removeEventListener("pointermove", moveClouds);
      hero?.removeEventListener("pointerleave", resetClouds);
      allowParallax.removeEventListener("change", resetClouds);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [pageId]);
  const siteTitle = tr(settings.title) || "Click Cross Initiative";
  const sections = (page?.sections || [])
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);
  const activeSocials = (Object.keys(socialChannels) as SocialChannel[]).filter(
    (channel) => settings.socialLinks?.[channel],
  );
  const learningSections = sections.filter(
    (section) => !section.display || section.display === "standard",
  );
  const partners = sections.filter(
    (section) => section.display === "partner" && section.image,
  );
  const testimonials = sections.filter(
    (section) => section.display === "testimonial" && tr(section.body).trim(),
  );
  const Arrow = () => <ArrowUpRight size={18} aria-hidden="true" />;
  const sectionExtras = (section: Section, linkClass = "text-link") => (
    <>
      {section.image && (
        <PublicImage
          className="section-image"
          src={section.image}
          alt={tr(section.heading)}
          loading="lazy"
        />
      )}
      {section.href && tr(section.cta) && (
        <a className={linkClass} href={contentHref(section.href)}>
          <span>{tr(section.cta)}</span>
          <Arrow />
        </a>
      )}
    </>
  );
  const additionalSections = (items: Section[]) =>
    items.map((section) => {
      const body = tr(section.body);
      if (pageId === "home" && section.id === "coverage") {
        const myanmar = ui("Myanmar", "မြန်မာ");
        const thailand = ui("Thailand", "ထိုင်း");
        return (
          <section className="coverage-section" id={section.id} key={section.id} aria-labelledby="coverage-title">
            <div className="coverage-copy">
              <h2 id="coverage-title">{tr(section.heading)}</h2>
              {body && <p className="editorial-body">{body}</p>}
              <ul className="coverage-legend" role="list">
                <li><span aria-hidden="true" />{myanmar}</li>
                <li><span aria-hidden="true" />{thailand}</li>
              </ul>
              {sectionExtras(section)}
            </div>
            {/* Globe boundaries use Natural Earth 1:50m Admin 0 data, version 5.1.2. */}
            <PublicImage
              className="coverage-globe"
              src="/images/implementation-globe.webp"
              alt=""
              width={1280}
              height={1152}
              loading="lazy"
            />
          </section>
        );
      }
      const [intro, ...focusAreas] =
        pageId === "home" && section.id === "focus"
          ? body.split(/\n[\t \r]*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
          : [body];

      return (
        <section
          className={`section-pad custom-section${focusAreas.length ? " focus-section" : ""}`}
          id={section.id}
          key={section.id}
        >
          <div className="custom-section-copy">
            <h2>{tr(section.heading)}</h2>
            {intro && <p className="editorial-body">{intro}</p>}
          </div>
          {focusAreas.length > 0 && (
            <ul className="focus-areas" role="list">
              {focusAreas.map((area, index) => {
                const Icon = focusIcons[index] ?? Lightbulb;
                return (
                  <li key={`${index}-${area}`}>
                    <span className="focus-icon" aria-hidden="true">
                      <Icon size={24} strokeWidth={1.75} />
                    </span>
                    <span>{area}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {sectionExtras(section)}
        </section>
      );
    });
  const editorialRows = (items: Section[]) =>
    items.length > 0 && (
      <section className="section-pad editorial-sections brief-editorial">
        {items.map((section) => (
          <article id={section.id} key={section.id}>
            <h2>{tr(section.heading)}</h2>
            <div>
              <p className="editorial-body">{tr(section.body)}</p>
              {sectionExtras(section)}
            </div>
          </article>
        ))}
      </section>
    );
  const contactOpportunities = (items: Section[]) => {
    let group: { intro?: Section; cards: Section[] } = { cards: [] };
    const groups = [group];
    for (const item of items) {
      if (contactGroupIds.has(item.id)) {
        group = { intro: item, cards: [] };
        groups.push(group);
      } else {
        group.cards.push(item);
      }
    }

    return (
      items.length > 0 && (
        <div className="section-pad contact-opportunities">
          {groups
            .filter(({ intro, cards }) => intro || cards.length)
            .map(({ intro, cards }) => {
              const isEnquiry = intro?.id === "get-in-touch";
              const heading = intro ? tr(intro.heading) : "";
              return (
                <section
                  className="contact-opportunity-group"
                  data-tone={
                    isEnquiry
                      ? "enquiry"
                      : intro?.id === "organisational-partnerships"
                        ? "warm"
                        : "slate"
                  }
                  aria-labelledby={intro ? `${intro.id}-heading` : undefined}
                  key={intro?.id ?? "other-opportunities"}
                >
                  {intro && (
                    <div className="contact-opportunity-heading" id={intro.id}>
                      <h2 id={`${intro.id}-heading`}>
                        {intro.id === "individual-contributions"
                          ? heading.replace(/^A\.\s+/, "")
                          : heading}
                      </h2>
                      {tr(intro.body) && (
                        <p className="editorial-body">{tr(intro.body)}</p>
                      )}
                      {sectionExtras(intro, "button navy")}
                    </div>
                  )}
                  {cards.length > 0 && (
                    <div className="contact-opportunity-grid">
                      {cards.map((item) => {
                        const Icon =
                          contactOpportunityIcons[item.id] ?? HeartHandshake;
                        const Title = intro ? "h3" : "h2";
                        return (
                          <article
                            className="contact-opportunity"
                            id={item.id}
                            key={item.id}
                          >
                            <span
                              className="contact-opportunity-icon"
                              aria-hidden="true"
                            >
                              <Icon size={24} strokeWidth={1.75} />
                            </span>
                            <Title>{tr(item.heading)}</Title>
                            {tr(item.body) && (
                              <p className="editorial-body">{tr(item.body)}</p>
                            )}
                            {sectionExtras(item)}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      )
    );
  };
  const pageLink = page?.url && page.kind === "page" && page.id !== "home" && (
    <a className="button navy page-outbound" href={page.url}>
      {ui("Learn more", "ပိုမိုလေ့လာရန်")}
      <Arrow />
    </a>
  );
  const editorialHero = page && heroDesign && (
    <section
      className={`editorial-hero editorial-hero-${pageId}${page.image ? " editorial-hero-custom" : ""}`}
      aria-labelledby="page-title"
    >
      <div className="editorial-hero-frame">
        <div className="editorial-hero-copy">
          <h1 id="page-title">{tr(page.title)}</h1>
          <p>{tr(page.description)}</p>
          {pageLink}
        </div>
        <figure
          className={
            !page.image && pageId === "initiatives"
              ? "editorial-hero-art editorial-hero-mascot"
              : "editorial-hero-art"
          }
        >
          <PublicImage
            src={page.image || heroDesign.image}
            alt={page.image ? page.alt : heroDesign.alt}
            fetchPriority="high"
          />
        </figure>
      </div>
    </section>
  );
  const statusBadge = (status: string) => (
    <span
      className={status === "Coming Soon" ? "status status-upcoming" : "status"}
      data-active={status === "Active"}
    >
      {status === "Active"
        ? ui("Active", "အသုံးပြုနိုင်သည်")
        : status === "Coming Soon"
          ? ui("Coming Soon", "မကြာမီ ရရှိမည်")
          : status}
    </span>
  );
  const initiativeCard = (item: Content) => {
    const image = item.cardImage || item.image;
    const alt = item.cardImage ? item.cardAlt : item.alt;
    const mascot =
      !item.cardImage && /^\/brand\/c2-0[12]\.webp$/.test(item.image);
    const Heading = pageId === "initiatives" ? "h2" : "h3";
    const description =
      tr(item.description) ||
      (item.status === "Coming Soon"
        ? ui("More information coming soon.", "မကြာမီ တွေ့ဆုံကြမည်။")
        : "");
    return (
      <a
        key={item.id}
        className={`initiative-card${image && !mascot ? " initiative-card-artwork" : ""}`}
        href={href(`initiatives/${item.id}`)}
        draggable={false}
      >
        <div
          className={
            !image
              ? "initiative-visual initiative-placeholder"
              : mascot
                ? "initiative-visual initiative-mascot"
                : "initiative-visual"
          }
        >
          {image && <PublicImage src={image} alt={alt || ""} loading="lazy" />}
        </div>
        <div className="card-top">{statusBadge(item.status)}</div>
        <div className="initiative-caption">
          <div>
            <Heading>{tr(item.title)}</Heading>
            {description && <p>{description}</p>}
          </div>
          <span className="round-arrow" aria-hidden="true">
            <Arrow />
          </span>
        </div>
      </a>
    );
  };
  const initiativeGallery = (items: Content[]) => (
    <InitiativeGallery cards={items.map(initiativeCard)} />
  );
  const closingSection = content
    .find((c) => c.id === "home")
    ?.sections.find((s) => s.id === "cta" && s.visible);
  const closing = (section = closingSection) =>
    !section ? null : (
      <section className="closing" key={section.id}>
        <div>
          <h2>{tr(section.heading)}</h2>
          {tr(section.body) && <p>{tr(section.body)}</p>}
          {section.image && (
            <PublicImage
              className="section-image"
              src={section.image}
              alt={tr(section.heading)}
              loading="lazy"
            />
          )}
        </div>
        {(section.href || publishedIds.has("contact")) && (
          <a
            className="button cream"
            href={section.href ? contentHref(section.href) : href("contact")}
          >
            {tr(section.cta) || ui("Let’s connect", "ဆက်သွယ်ကြစို့")}
            <Arrow />
          </a>
        )}
      </section>
    );
  const homeFeatures = pageId === "home" && (
    <>
      {publishedIds.has("initiatives") &&
        initiatives.some((item) => item.featured) && (
          <section className="initiatives-section section-pad">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {ui("OUR INITIATIVES", "ကျွန်ုပ်တို့၏ အစီအစဉ်များ")}
                </span>
                <h2>
                  {ui("Different paths.", "မတူညီသော လမ်းကြောင်းများ။")}
                  <br />
                  {ui("One safer community.", "ပိုမိုလုံခြုံသော အသိုင်းအဝိုင်း။")}
                </h2>
              </div>
              <a className="text-link" href={href("initiatives")}>
                {ui("View all initiatives", "အစီအစဉ်အားလုံး ကြည့်ရန်")}
                <Arrow />
              </a>
            </div>
            {initiativeGallery(initiatives.filter((c) => c.featured))}
          </section>
        )}
      {impactPage && (
        <section className="impact-preview section-pad">
          <figure className={`editorial-photo${impactPage.image ? " editorial-photo-custom" : ""}`}>
            <PublicImage
              src={impactPage.image || "/images/learning.webp"}
              alt={
                impactPage.alt || "Students learning together around a laptop"
              }
              loading="lazy"
            />
            {!impactPage.image && (
              <figcaption>Illustrative photography · Unsplash</figcaption>
            )}
          </figure>
          <div>
            <h2>{tr(impactPage.title)}</h2>
            <p>{tr(impactPage.description)}</p>
            <a className="button navy" href={href("impact")}>
              {ui("Explore our impact", "အကျိုးသက်ရောက်မှုကို လေ့လာရန်")}
              <Arrow />
            </a>
          </div>
        </section>
      )}
    </>
  );
  const impactMetrics = content
    .filter((item) => item.kind === "impact")
    .sort((a, b) => a.order - b.order);
  const metricsGrid = impactMetrics.length > 0 && (
    <div className="metrics-grid">
      {impactMetrics.map((metric) => (
        <article key={metric.id}>
          {metric.value && <ImpactNumber value={metric.value} />}
          <h3>{tr(metric.title)}</h3>
          <p>{tr(metric.description)}</p>
          {metric.period &&
            metric.period !== "Reporting period not specified" && (
              <small>{metric.period}</small>
            )}
          {metric.sections
            .filter((section) => section.visible)
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <div key={section.id}>
                <h4>{tr(section.heading)}</h4>
                <p className="editorial-body">{tr(section.body)}</p>
                {sectionExtras(section)}
              </div>
            ))}
        </article>
      ))}
    </div>
  );
  const impactAtGlance = metricsGrid && (
    <section
      className="section-pad impact-at-glance"
      aria-label={ui("Our Impact at a Glance", "ကျွန်ုပ်တို့၏ အကျိုးသက်ရောက်မှု")}
    >
      <h2>{ui("Our Impact at a Glance", "ကျွန်ုပ်တို့၏ အကျိုးသက်ရောက်မှု")}</h2>
      {metricsGrid}
    </section>
  );
  const hasBriefPillars =
    pageId === "way-way-shaung" &&
    learningSections.some((section) => section.id === "pillars");
  async function sendContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState({ busy: true, error: "", success: "" });
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch(
        contactTest ? "/api/contact-test" : "/api/contact",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...Object.fromEntries(f),
            consent: f.get("consent") === "on",
            language: lang,
          }),
        },
      );
      const b: any = await r.json();
      if (!r.ok) throw Error(b.error);
      setFormState({ busy: false, error: "", success: b.message });
    } catch (e: any) {
      setFormState({ busy: false, error: e.message, success: "" });
    }
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className={"nav-shell" + (overHero ? " over-hero" : "")}>
        <header className={"header" + (scrolled ? " glass" : "")}>
          <a href={href()} aria-label={siteTitle} className="brand" draggable={false}>
            <PublicImage
              className={settings.image && settings.image !== "/brand/cci-logo.webp" ? "brand-image-custom" : undefined}
              src={settings.image || "/brand/cci-logo.webp"}
              alt={settings.alt || "Click Cross Initiative"}
            />
          </a>
          <nav aria-label="Main navigation" className={menu ? "open" : ""}>
            {availableNav.map(([url, en, my]) => (
              <a
                className={
                  (pageId === "home" && url === "") || url === parts[0]
                    ? "active"
                    : ""
                }
                href={href(url)}
                key={en}
              >
                {ui(en, my)}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <a
              className="language"
              href={`/${lang === "en" ? "my" : "en"}${parts.length ? "/" + parts.join("/") : ""}`}
              aria-label={
                lang === "en" ? "Switch to Myanmar" : "Switch to English"
              }
            >
              <Globe2 size={16} />
              {lang === "en" ? "မြန်မာ" : "EN"}
            </a>
            {publishedIds.has("initiatives") && (
              <a className="header-cta" href={href("initiatives")}>
                {ui("Explore initiatives", "အစီအစဉ်များ")}
                <Arrow />
              </a>
            )}
            <button
              className="mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
              aria-expanded={menu}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </header>
      </div>
      <main
        id="main"
        className={pageId === "home" ? "campaign-home" : undefined}
      >
        {page?.image && page.kind === "page" && !overHero && (
          <PublicImage className="page-cover" src={page.image} alt={page.alt} />
        )}
        {!page ? (
          <section className="page-hero">
            <h1>Let’s get you back on track.</h1>
            <a className="button navy" href={href()}>
              Back to Home
              <Arrow />
            </a>
          </section>
        ) : pageId === "home" ? (
          <>
            <div className="campaign-track">
              <section className="hero photo-hero">
                <PublicImage
                  className={`hero-photograph${page.image ? " hero-photograph-custom" : ""}`}
                  src={page.image || "/images/community.webp"}
                  alt={
                    page.image
                      ? page.alt
                      : "A group of friends sitting together by the water"
                  }
                  fetchPriority="high"
                />
                <div className="hero-copy">
                  <div className="hero-clouds" aria-hidden="true">
                    <span className="hero-cloud cloud-far" />
                    <span className="hero-cloud cloud-near" />
                  </div>
                  <h1
                    className="campaign-title"
                    style={{
                      backgroundImage: `url(${JSON.stringify(page.image || "/images/community.webp")})`,
                    }}
                  >
                    {siteTitle === "Click Cross Initiative" ? (
                      <>
                        <span>Click Cross</span> <span>Initiative</span>
                      </>
                    ) : (
                      <span className="custom-brand-title">{siteTitle}</span>
                    )}
                  </h1>
                  <p className="campaign-mission">{tr(page.title)}</p>
                  <div className="hero-bottom">
                    <div className="hero-buttons">
                      {(page.url || publishedIds.has("initiatives")) && (
                        <a
                          className="button cream"
                          href={page.url || href("initiatives")}
                        >
                          {tr(page.ctaLabel) ||
                            ui("Explore Our Initiatives", "ကျွန်ုပ်တို့၏ အစီအစဉ်များ")}
                          <Arrow />
                        </a>
                      )}
                      {(page.secondaryUrl || publishedIds.has("about")) && (
                        <a
                          className="text-link"
                          href={
                            page.secondaryUrl
                              ? contentHref(page.secondaryUrl)
                              : href("about")
                          }
                        >
                          {tr(page.secondaryCtaLabel) ||
                            ui("About us", "ကျွန်ုပ်တို့အကြောင်း")}
                          <ArrowRight size={17} />
                        </a>
                      )}
                    </div>
                    <p>{tr(page.description)}</p>
                  </div>
                </div>
              </section>
            </div>
            {!sections.some((section) => section.id === "intro") &&
              homeFeatures}
            {sections
              .filter((section) => section.id !== "cta")
              .map((section) =>
                section.id === "intro" ? (
                  <Fragment key={section.id}>
                    <section className="intro section-pad" id={section.id}>
                      <div>
                        <span className="eyebrow">
                          {ui("WHO WE ARE", "ကျွန်ုပ်တို့အကြောင်း")}
                        </span>
                        <h2>{tr(section.heading)}</h2>
                      </div>
                      <div className="intro-body">
                        <p className="editorial-body">{tr(section.body)}</p>
                        {sectionExtras(section)}
                        {!section.href && publishedIds.has("about") && (
                          <a className="text-link" href={href("about")}>
                            {ui("Get to know CCI", "CCI အကြောင်း လေ့လာရန်")}
                            <Arrow />
                          </a>
                        )}
                      </div>
                    </section>
                    {homeFeatures}
                  </Fragment>
                ) : (
                  additionalSections([section])
                ),
              )}
            {impactAtGlance}
            {closing()}
          </>
        ) : page.kind === "initiative" ? (
          <>
            <section
              className={`initiative-detail page-hero ${page.id === "way-way-shaung" ? "wws-detail" : ""}`}
            >
              <div>
                <a className="breadcrumb" href={href("initiatives")}>
                  Our Initiatives <ArrowRight size={14} />
                </a>
                {statusBadge(page.status)}
                <h1>{tr(page.title)}</h1>
                <p>
                  {tr(page.description) ||
                    "More about this initiative will be shared when it is ready."}
                </p>
                {page.url && page.status !== "Coming Soon" ? (
                  <a
                    className="button navy"
                    href={page.url}
                    rel="noopener noreferrer"
                  >
                    {page.id === "way-way-shaung"
                      ? ui("Start Learning", "စတင်လေ့လာရန်")
                      : ui("Visit initiative", "အစီအစဉ်သို့ သွားရန်")}
                    <Arrow />
                  </a>
                ) : page.status === "Coming Soon" ? (
                  <span className="button coming">
                    <LockKeyhole size={16} />
                    {ui("Platform coming soon", "ပလက်ဖောင်း မကြာမီ ရရှိမည်")}
                  </span>
                ) : null}
              </div>
              {page.image ? (
                <div className="detail-mascot">
                  <PublicImage src={page.image} alt={page.alt} />
                  {page.id === "way-way-shaung" && (
                    <span>
                      Meet C2 <small>Pronounced “Si Thu”</small>
                    </span>
                  )}
                </div>
              ) : (
                <div className="lotus-detail-art">
                  <span>{tr(page.title)}</span>
                </div>
              )}
            </section>
            {hasBriefPillars && editorialRows(learningSections)}
            {!hasBriefPillars && learningSections.length > 0 && (
              <section className="section-pad">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">LEARN. PRACTICE. SHARE.</span>
                    <h2>
                      Three ways to build
                      <br />
                      your scam awareness.
                    </h2>
                  </div>
                  <p className="section-aside">
                    A preview of the planned Way Way Shaung learning experience.
                    The learning platform is being developed separately.
                  </p>
                </div>
                <div className="feature-grid">
                  {learningSections.map((s, i) => {
                    const Icon = [Fingerprint, BookOpen, MessagesSquare][i % 3];
                    return (
                      <article key={s.id}>
                        <Icon size={30} strokeWidth={1.3} />
                        <span className="feature-number">0{i + 1}</span>
                        <h3>{tr(s.heading)}</h3>
                        <p>{tr(s.body)}</p>
                        {sectionExtras(s)}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {page.id === "way-way-shaung" && !hasBriefPillars && (
              <section className="journey section-pad">
                <span className="eyebrow">THE LEARNING JOURNEY</span>
                <h2>Small steps. Lasting awareness.</h2>
                <div>
                  {[
                    "Take the DNA test",
                    "Discover your profile",
                    "Explore recommended learning",
                    "Practice scam awareness",
                    "Track your progress",
                    "Reassess your knowledge",
                  ].map((s, i) => (
                    <article key={s}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <h3>{s}</h3>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {partners.length > 0 && (
              <section className="section-pad initiative-partners">
                <h2>{ui("Partners", "မိတ်ဖက်များ")}</h2>
                <ul className="partner-grid">
                  {partners.map((partner) => {
                    const logo = (
                      <PublicImage
                        src={partner.image}
                        alt={tr(partner.heading)}
                        loading="lazy"
                      />
                    );
                    return (
                      <li key={partner.id}>
                        {partner.href ? (
                          <a href={partner.href} rel="noopener noreferrer" draggable={false}>
                            {logo}
                          </a>
                        ) : (
                          logo
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {testimonials.length > 0 && (
              <section className="section-pad initiative-testimonials">
                <h2>{ui("Testimonials", "အတွေ့အကြုံ မျှဝေချက်များ")}</h2>
                <div className="testimonial-grid">
                  {testimonials.map((entry) => (
                    <blockquote key={entry.id}>
                      <p>{tr(entry.body)}</p>
                      <footer>{tr(entry.heading)}</footer>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}
            {closing()}
          </>
        ) : pageId === "initiatives" ? (
          <>
            {editorialHero}
            <section className="section-pad initiatives-list">
              {initiativeGallery(initiatives)}
            </section>
            {additionalSections(sections)}
            {impactAtGlance}
            {closing()}
          </>
        ) : pageId === "contact" ? (
          <>
            <section
              className="contact-layout editorial-hero editorial-hero-contact"
              aria-labelledby="page-title"
            >
              <div className="editorial-hero-copy">
                <h1 id="page-title">{tr(page.title)}</h1>
                <p className="editorial-body">{tr(page.description)}</p>
                {pageLink}
                <div className="contact-info">
                  {settings.email && (
                    <a href={`mailto:${settings.email}`}>
                      <Mail size={20} />
                      <span>{settings.email}</span>
                    </a>
                  )}
                  {settings.phone && <p>{settings.phone}</p>}
                  {settings.address && <p>{settings.address}</p>}
                  {settings.social && (
                    <a
                      href={settings.social}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Find us on social media
                      <Arrow />
                    </a>
                  )}
                </div>
                <figure className={`editorial-hero-art contact-hero-photo${page.image ? " contact-hero-photo-custom" : ""}`}>
                  <PublicImage
                    src={page.image || "/images/contact-desk.webp"}
                    alt={
                      page.image
                        ? page.alt
                        : "A person writing in a notebook beside a laptop and phone"
                    }
                    fetchPriority="high"
                  />
                </figure>
              </div>
              <form
                id="contact-form"
                className="contact-form"
                onSubmit={sendContact}
              >
                <h2>
                  {tr(settings.contactFormTitle) ||
                    ui("Start a conversation", "စကားပြောကြစို့")}
                </h2>
                {contactTest && (
                  <p className="notice">
                    Staff test mode. Use sample data only. Messages appear in
                    Enquiries with a [TEST] prefix.
                  </p>
                )}
                {!acceptsEnquiries && (
                  <div className="notice">
                    Online enquiries are temporarily paused.
                  </div>
                )}
                {formState.success ? (
                  <div className="success" role="status">
                    <Check />
                    {formState.success}
                    {contactTest && (
                      <a className="text-link" href="/admin?tab=enquiries">
                        Open Enquiries
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    <fieldset disabled={!acceptsEnquiries || formState.busy}>
                      <div className="enquiry-form-group enquiry-type-field">
                        <span>
                          {ui("Inquiry type", "ဆက်သွယ်ရသည့် အကြောင်းအရာ")}
                        </span>
                        <ChoiceField
                          name="enquiryType"
                          label={ui("Inquiry type", "ဆက်သွယ်ရသည့် အကြောင်းအရာ")}
                          defaultValue="general"
                          options={Object.entries(enquiryTypes).map(([value, label]) => ({
                            value,
                            label: tr(label),
                          }))}
                          required
                          disabled={!acceptsEnquiries || formState.busy}
                        />
                      </div>
                      <fieldset className="enquiry-form-group">
                        <legend>
                          {ui("Contact information", "ဆက်သွယ်ရန် အချက်အလက်များ")}
                        </legend>
                        <div className="enquiry-contact-fields">
                          <label>
                            <span>
                              {ui("Full name", "အမည်အပြည့်အစုံ")}{" "}
                              <span aria-hidden="true">*</span>
                            </span>
                            <Input
                              name="name"
                              autoComplete="name"
                              required
                              maxLength={100}
                              placeholder={ui("Your full name", "သင့်အမည်အပြည့်အစုံ")}
                            />
                          </label>
                          <label>
                            <span>
                              {ui("Email address", "အီးမေးလ်လိပ်စာ")}{" "}
                              <span aria-hidden="true">*</span>
                            </span>
                            <Input
                              name="email"
                              type="email"
                              autoComplete="email"
                              required
                              maxLength={254}
                              placeholder="name@example.com"
                            />
                          </label>
                          <label>
                            {ui("Organisation / Institution", "အဖွဲ့အစည်း / ဌာန")}
                            <Input
                              name="organisation"
                              autoComplete="organization"
                              maxLength={160}
                              placeholder={ui(
                                "Organisation name",
                                "အဖွဲ့အစည်းအမည်",
                              )}
                            />
                          </label>
                          <label>
                            {ui("Country / Location", "နိုင်ငံ / တည်နေရာ")}
                            <Input
                              name="location"
                              maxLength={160}
                              placeholder={ui(
                                "e.g. Myanmar, Thailand",
                                "ဥပမာ မြန်မာ၊ ထိုင်း",
                              )}
                            />
                          </label>
                        </div>
                      </fieldset>
                      <label className="enquiry-message-field">
                        <span>
                          {ui("Your message", "သင်ပေးပို့လိုသည့် အကြောင်းအရာ")}{" "}
                          <span aria-hidden="true">*</span>
                        </span>
                        <Textarea
                          name="message"
                          required
                          maxLength={5000}
                          rows={5}
                          placeholder={ui(
                            "Tell us about your enquiry or collaboration idea…",
                            "သင့်မေးမြန်းချက် သို့မဟုတ် ပူးပေါင်းဆောင်ရွက်လိုသည့် အကြောင်းအရာကို ရေးပါ…",
                          )}
                        />
                      </label>
                      <label className="honeypot" aria-hidden="true">
                        Website
                        <input
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                        />
                      </label>
                      <label className="checkbox">
                        <input type="checkbox" name="consent" required />
                        <span>
                          {contactTest ? (
                            "I confirm this submission contains only test data."
                          ) : (
                            <>
                              {ui("I agree to the ", "ကျွန်ုပ်သည် ")}
                              <a href={href("privacy")}>
                                {ui("Privacy Policy", "ကိုယ်ရေးအချက်အလက် မူဝါဒ")}
                              </a>
                              {ui(
                                " and the processing of my enquiry.",
                                " နှင့် မေးမြန်းချက်ကို ဆောင်ရွက်ပေးခြင်းအား သဘောတူပါသည်။",
                              )}
                            </>
                          )}
                        </span>
                      </label>
                      <button className="button navy" type="submit">
                        {formState.busy
                          ? "Sending…"
                          : contactTest
                            ? "Send test enquiry"
                            : ui("Send enquiry", "မေးမြန်းချက် ပေးပို့ရန်")}
                        <Arrow />
                      </button>
                    </fieldset>
                    {formState.error && (
                      <p className="error" role="alert">
                        {formState.error}
                      </p>
                    )}
                    <p className="form-note">
                      Please do not include passwords, financial details or
                      sensitive scam evidence.
                    </p>
                  </>
                )}
              </form>
            </section>
            {contactOpportunities(sections)}
          </>
        ) : (
          <>
            {editorialHero ?? (
              <section className="page-hero compact">
                <h1>{tr(page.title)}</h1>
                <p>{tr(page.description)}</p>
                {pageLink}
              </section>
            )}
            {pageId === "about" ? (
              <AboutStory
                sections={sections}
                translate={tr}
                linkFor={contentHref}
                navigationLabel={ui("About this organization", "အဖွဲ့အစည်းအကြောင်း")}
              />
            ) : (
            <section
              className={`section-pad editorial-sections ${pageId === "privacy" ? "privacy-content" : ""}`}
            >
              {sections.map((s, i) => (
                <article id={s.id} key={s.id}>
                  <span className="eyebrow">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2>{tr(s.heading)}</h2>
                  <div className="editorial-section-copy">
                    {tr(s.body) && (
                      <p className="editorial-body">{tr(s.body)}</p>
                    )}
                    {sectionExtras(s, "button navy")}
                  </div>
                </article>
              ))}
              {pageId === "impact" && metricsGrid}
              {pageId === "impact" && publishedIds.has("initiatives") && (
                <a
                  className="button accent impact-initiatives-link"
                  href={href("initiatives")}
                >
                  {ui("Explore Our Initiatives", "ကျွန်ုပ်တို့၏ အစီအစဉ်များ")}
                  <Arrow />
                </a>
              )}
            </section>
            )}
            {pageId !== "privacy" && closing()}
          </>
        )}
        {additionalSections(
          settings.sections
            .filter((section) => section.visible)
            .sort((a, b) => a.order - b.order),
        )}
      </main>
      <footer className="footer">
        <div className="footer-main">
          <a className="brand" href={href()} draggable={false}>
            <PublicImage
              className={settings.image && settings.image !== "/brand/cci-logo.webp" ? "brand-image-custom" : undefined}
              src={settings.image || "/brand/cci-logo.webp"}
              alt={settings.alt || "Click Cross Initiative"}
            />
          </a>
          <p className="footer-tagline">{tr(settings.description)}</p>
          {(activeSocials.length > 0 || settings.social) && (
            <nav className="footer-social" aria-label="Social media">
              {activeSocials.map((channel) => {
                const Icon = socialIcons[channel];
                return (
                  <a
                    key={channel}
                    href={settings.socialLinks?.[channel]}
                    aria-label={socialChannels[channel]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon aria-hidden="true" size={17} />
                  </a>
                );
              })}
              {settings.social &&
                !activeSocials.some(
                  (channel) =>
                    settings.socialLinks?.[channel] === settings.social,
                ) && (
                  <a
                    href={settings.social}
                    aria-label="Other social channel"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe2 aria-hidden="true" size={17} />
                  </a>
                )}
            </nav>
          )}
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {tr(settings.title)}
          </span>
          <div>
            {availableNav.map(([p, en, my]) => (
              <a key={p} href={href(p)}>
                {ui(en, my)}
              </a>
            ))}
            {publishedIds.has("privacy") && (
              <a href={href("privacy")}>Privacy Policy</a>
            )}
          </div>
        </div>
        {preview && (
          <div className="preview-bar">
            Draft preview · Changes are visible only to authorized staff.
          </div>
        )}
      </footer>
    </>
  );
}
