export const socialChannels = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
} as const;
export type SocialChannel = keyof typeof socialChannels;

export type LocaleText = { en: string; my: string };
export type Section = {
  id: string;
  display?: "standard" | "partner" | "testimonial";
  heading: LocaleText;
  body: LocaleText;
  image: string;
  cta: LocaleText;
  href: string;
  visible: boolean;
  order: number;
};
export type Content = {
  id: string;
  kind: "page" | "initiative" | "impact" | "settings";
  title: LocaleText;
  description: LocaleText;
  status: string;
  image: string;
  alt: string;
  cardImage?: string;
  cardAlt?: string;
  url: string;
  featured: boolean;
  order: number;
  sections: Section[];
  value?: string;
  source?: string;
  period?: string;
  email?: string;
  phone?: string;
  address?: string;
  social?: string;
  socialLinks?: Partial<Record<SocialChannel, string>>;
  privacyApproved?: boolean;
  contactFormTitle?: LocaleText;
  contactConfirmation?: LocaleText;
  preview?: boolean;
  ctaLabel?: LocaleText;
  secondaryCtaLabel?: LocaleText;
  secondaryUrl?: string;
  seoTitle?: LocaleText;
  seoDescription?: LocaleText;
};
const t = (en: string): LocaleText => ({ en, my: "" });
const section = (
  id: string,
  heading: string,
  body: string,
  order = 0,
): Section => ({
  id,
  heading: t(heading),
  body: t(body),
  image: "",
  cta: t(""),
  href: "",
  visible: true,
  order,
});
const base = (
  id: string,
  kind: Content["kind"],
  title: string,
  description = "",
): Content => ({
  id,
  kind,
  title: t(title),
  description: t(description),
  status: "Coming Soon",
  image: "",
  alt: "",
  url: "",
  featured: false,
  order: 0,
  sections: [],
});
export const initialContent: Content[] = [
  {
    ...base(
      "home",
      "page",
      "Building a safer digital community.",
      "Explore the initiatives helping communities learn about digital safety, recognize online risks and build stronger awareness.",
    ),
    sections: [
      section(
        "intro",
        "A little awareness. A world of difference.",
        "Click Cross Initiative brings digital safety, scam awareness and education together. Explore the initiatives designed to help people navigate online risks with more confidence.",
      ),
      section(
        "cta",
        "Safer online. Stronger together.",
        "Discover our initiatives, get to know CCI, or start a conversation about digital safety.",
        1,
      ),
    ],
  },
  {
    ...base(
      "about",
      "page",
      "Digital safety starts with people.",
      "Get to know Click Cross Initiative and our focus on scam awareness, digital safety and education.",
    ),
    sections: [
      {
        ...section(
          "mission",
          "Our mission",
          "Mission statement awaiting client approval.",
        ),
        visible: false,
      },
      {
        ...section(
          "vision",
          "Our vision",
          "Vision statement awaiting client approval.",
        ),
        visible: false,
      },
      {
        ...section(
          "background",
          "Our background",
          "Organization history and objectives awaiting client approval.",
        ),
        visible: false,
      },
    ],
  },
  {
    ...base(
      "initiatives",
      "page",
      "Purpose, put into action.",
      "Discover the initiatives connecting digital safety, education and community awareness.",
    ),
  },
  {
    ...base(
      "impact",
      "page",
      "Every safer choice matters.",
      "Discover our focus on awareness, learning and community. Documented activities and stories will be shared here as they are approved.",
    ),
    sections: [
      section(
        "focus",
        "Awareness becomes action.",
        "Our initiatives connect learning about online risks with opportunities to build scam awareness. Explore Way Way Shaung to see the planned approach.",
      ),
    ],
  },
  {
    ...base(
      "contact",
      "page",
      "Let’s make a safer connection.",
      "Have a question about CCI or our initiatives? Get in touch with our team.",
    ),
  },
  {
    ...base(
      "privacy",
      "page",
      "Privacy Policy",
      "How Click Cross Initiative handles information you share through this website, including contact form enquiries.",
    ),
    sections: [
      {
        id: "scope",
        heading: {
          en: "About this notice",
          my: "",
        },
        body: {
          en: "Click Cross Initiative (CCI) operates this organization website. This notice explains what happens when you browse the site or contact CCI. Other websites and platforms linked here, including learning and social media services, have their own privacy notices.",
          my: "",
        },
        image: "",
        cta: {
          en: "",
          my: "",
        },
        href: "",
        visible: true,
        order: 0,
      },
      {
        id: "enquiries",
        heading: {
          en: "What we collect when you contact us",
          my: "",
        },
        body: {
          en: "The contact form asks for your name, email address, subject, and message. We record when the enquiry arrives. Authorized staff can add internal notes and update the enquiry status. Please leave out passwords, payment details, identity documents, and sensitive evidence.",
          my: "",
        },
        image: "",
        cta: {
          en: "",
          my: "",
        },
        href: "",
        visible: true,
        order: 1,
      },
      {
        id: "use",
        heading: {
          en: "How we use your enquiry",
          my: "",
        },
        body: {
          en: "We use your message to review your request, follow up with you, and keep a record of how it was handled. We use technical information such as your IP address to limit repeated submissions and reduce abuse.",
          my: "",
        },
        image: "",
        cta: {
          en: "",
          my: "",
        },
        href: "",
        visible: true,
        order: 2,
      },
      {
        id: "access",
        heading: {
          en: "Who can access your information",
          my: "",
        },
        body: {
          en: "Enquiries are stored in the website's staff inbox. Access is restricted to authorized staff. The services that host the website and support staff sign-in process information as part of providing those services. When you follow an external link, the destination handles information under its own practices.",
          my: "",
        },
        image: "",
        cta: {
          en: "",
          my: "",
        },
        href: "",
        visible: true,
        order: 3,
      },
      {
        id: "retention",
        heading: {
          en: "How long information is kept",
          my: "",
        },
        body: {
          en: "Enquiries are kept in the inbox for follow-up and recordkeeping. Closing an enquiry changes its status and does not automatically delete it. If you would like us to review whether we can delete a record, contact us using the details below.",
          my: "",
        },
        image: "",
        cta: {
          en: "",
          my: "",
        },
        href: "",
        visible: true,
        order: 4,
      },
      {
        id: "choices",
        heading: {
          en: "Questions and requests",
          my: "",
        },
        body: {
          en: "Use Contact Us to ask how we have handled your enquiry or to request access, a correction, or deletion. Include enough information for us to identify your enquiry, such as the email address used and the approximate date. We may need to verify the request before sharing or changing information.",
          my: "",
        },
        image: "",
        cta: {
          en: "Contact us",
          my: "",
        },
        href: "/en/contact",
        visible: true,
        order: 5,
      },
    ],
  },
  {
    ...base(
      "way-way-shaung",
      "initiative",
      "Way Way Shaung",
      "A scam-awareness learning initiative combining Anti-Scam DNA assessment, cybersecurity education and community scam reporting.",
    ),
    featured: true,
    image: "/brand/c2-02.webp",
    alt: "C2, the friendly red Way Way Shaung robot, smiling in an orange hat",
    sections: [
      section(
        "dna",
        "Anti-Scam DNA Test",
        "Discover scam-related behavioral vulnerabilities through an assessment.",
      ),
      section(
        "learning",
        "CyberSafe E-Learning",
        "Explore video learning, quizzes and realistic scam scenarios.",
        1,
      ),
      section(
        "watch",
        "Community Scam Watch",
        "Learn from shared experiences through a community with administrator-reviewed scam reports.",
        2,
      ),
    ],
  },
  {
    ...base("cyber-lotus", "initiative", "Cyber Lotus"),
    order: 1,
    featured: true,
  },
  {
    ...base(
      "site",
      "settings",
      "Click Cross Initiative",
      "Click Safe. Cross Scams.",
    ),
    email: "",
    phone: "",
    address: "",
    social: "",
    socialLinks: { facebook: "https://www.facebook.com/clickcrossinitiative/" },
    privacyApproved: true,
    preview: true,
    image: "/brand/cci-logo.webp",
    alt: "Click Cross Initiative. Click Safe. Cross Scams.",
  },
];
export function textFor(value: LocaleText | undefined, lang: string) {
  return value?.[lang === "my" ? "my" : "en"] || value?.en || "";
}
export const rolePermissions: Record<string, string[]> = {
  super: [
    "read",
    "edit",
    "publish",
    "media",
    "enquiries",
    "settings",
    "users",
    "audit",
  ],
  editor: ["read", "edit", "media"],
  publisher: ["read", "edit", "publish", "media", "audit"],
  enquiry: ["enquiries"],
};
