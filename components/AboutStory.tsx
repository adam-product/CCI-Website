import {
  ArrowUpRight,
  Award,
  BookOpen,
  HeartHandshake,
  Lightbulb,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import type { LocaleText, Section } from "../lib/content";
import { PublicImage } from "./PublicImage";

const storyPhotos: Record<string, string> = {
  background: "/images/community.webp",
  "founding-story": "/images/contact-desk.webp",
  mission: "/images/learning.webp",
};
const valuesIcons = [ShieldCheck, BookOpen, HeartHandshake, Lightbulb];
const founderPortraits = new Map([
  ["aye mya mya phoo", "/images/aye-mya-mya-phoo.webp"],
  ["ye win aung", "/images/ye-win-aung.webp"],
]);

function StoryBody({ id, body }: { id: string; body: string }) {
  if (!body.trim()) return null;
  const lines = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  if (id === "values") {
    return (
      <ul className="story-values-list" role="list">
        {lines.map((value, index) => {
          const Icon = valuesIcons[index % valuesIcons.length];
          return (
            <li key={index}>
              <Icon aria-hidden="true" />
              <span>{value}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (id === "team" && lines.length > 1) {
    const [role, ...names] = lines;
    return (
      <>
        <p className="story-team-role">{role}</p>
        <ul className="story-people" role="list">
          {names.map((name, index) => {
            const portrait = founderPortraits.get(name.replace(/\s+/g, " ").toLowerCase());
            return (
              <li key={index}>
                <div className="story-portrait">
                  {portrait ? (
                    <PublicImage src={portrait} alt="" width={216} height={216} loading="lazy" />
                  ) : (
                    <span aria-hidden="true">{name.split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join("")}</span>
                  )}
                </div>
                <h3>{name}</h3>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  if (id === "achievements") {
    return (
      <ol className="story-timeline" role="list">
        {lines.map((line, index) => {
          const entry = line.match(/^(\p{Nd}{4})\s+(.+)$/u);
          const award = entry ? entry[2] : line;
          const details = award.match(/^(.*?)\s*[|·]\s*(.+)$/u);
          return (
            <li key={index}>
              <div className="story-award-mark">
                <Award size={20} strokeWidth={1.65} aria-hidden="true" />
                {entry && <span>{entry[1]}</span>}
              </div>
              <div className="story-award-copy">
                <h3>{details ? details[1] : award}</h3>
                {details && <p>{details[2]}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return <p className="editorial-body">{body}</p>;
}

export default function AboutStory({
  sections,
  translate,
  linkFor,
  navigationLabel,
}: {
  sections: Section[];
  translate: (value: LocaleText) => string;
  linkFor: (value: string) => string;
  navigationLabel: string;
}) {
  if (sections.length === 0) return null;

  return (
    <section className="about-story section-pad" aria-label={navigationLabel}>
      <nav className="about-story-nav" aria-label={navigationLabel}>
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>{translate(section.heading)}</a>
        ))}
      </nav>
      {sections.map((section) => {
        const title = translate(section.heading);
        const src = section.image || storyPhotos[section.id];
        const link = translate(section.cta);
        const VisualIcon = section.id === "vision"
          ? Telescope
          : section.id === "partnerships"
            ? HeartHandshake
            : null;

        return (
          <article
            className={`story-chapter story-${section.id}${src || VisualIcon ? " story-has-visual" : ""}`}
            id={section.id}
            key={section.id}
            aria-labelledby={`${section.id}-story-title`}
          >
            <div className="story-copy">
              <h2 id={`${section.id}-story-title`}>{title}</h2>
              <StoryBody id={section.id} body={translate(section.body)} />
              {section.href && link && (
                <a className={`button ${section.id === "partnerships" ? "accent" : "navy"}`} href={linkFor(section.href)}>
                  {link}<ArrowUpRight size={18} aria-hidden="true" />
                </a>
              )}
            </div>
            {src ? (
              <div className={`story-photo${section.image ? " story-photo-custom" : ""}`}>
                <PublicImage src={src} alt={section.image ? title : ""} loading="lazy" />
              </div>
            ) : VisualIcon && (
              <div className="story-illustration" aria-hidden="true">
                <VisualIcon strokeWidth={1.2} />
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
