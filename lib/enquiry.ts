export const enquiryTypes = {
  general: { en: "General Inquiry", my: "အထွေထွေ စုံစမ်းမေးမြန်းခြင်း" },
  individual: { en: "Individual Contribution", my: "တစ်ဦးချင်း ပါဝင်ကူညီခြင်း" },
  partnership: {
    en: "Organizational Partnership",
    my: "အဖွဲ့အစည်းအလိုက် ပူးပေါင်းခြင်း",
  },
  media: { en: "Media & Communications", my: "မီဒီယာနှင့် ဆက်သွယ်ရေး" },
  funding: { en: "Funding & Sponsorship", my: "ရန်ပုံငွေနှင့် ပံ့ပိုးကူညီမှု" },
  other: { en: "Other", my: "အခြား" },
} as const;

export function isEnquiryType(
  value: unknown,
): value is keyof typeof enquiryTypes {
  return typeof value === "string" && Object.hasOwn(enquiryTypes, value);
}
