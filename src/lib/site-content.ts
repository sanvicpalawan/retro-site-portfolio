export type SiteContent = {
  logoData: string | null;
  badgeText: string;
  heroHeading: string;
  heroHighlight: string;
  heroDescription: string;
  collectionHeading: string;
  collectionDescription: string;
  aboutText: string;
  footerOrganization: string;
  footerTagline: string;
  footerEmail: string;
  footerPhone: string;
  footerLocation: string;
  footerLegal: string;
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  logoData: null,
  badgeText: "YOUR DIGITAL HOME",
  heroHeading: "GOOD THINGS,",
  heroHighlight: "ALL IN ONE PLACE.",
  heroDescription:
    "Your calm corner of the internet. The sites your collective loves, ready whenever you need them.",
  collectionHeading: "PROJECT DIRECTORY",
  collectionDescription: "Open the right environment, repository, or deployment for each project.",
  aboutText: "Made for a little more focus, and a little less searching.",
  footerOrganization: "Palawan Collective",
  footerTagline: "A shared developer directory for our project environments, repositories, and deployments.",
  footerEmail: "",
  footerPhone: "",
  footerLocation: "Manila × Texas",
  footerLegal: "All rights reserved.",
};

const CONTENT_LIMITS: Record<Exclude<keyof SiteContent, "logoData">, number> = {
  badgeText: 80,
  heroHeading: 120,
  heroHighlight: 120,
  heroDescription: 600,
  collectionHeading: 120,
  collectionDescription: 300,
  aboutText: 300,
  footerOrganization: 120,
  footerTagline: 300,
  footerEmail: 180,
  footerPhone: 60,
  footerLocation: 180,
  footerLegal: 200,
};

export function parseSiteContent(value: unknown): SiteContent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const parsed = { ...DEFAULT_SITE_CONTENT } as SiteContent;

  for (const [key, limit] of Object.entries(CONTENT_LIMITS) as [
    Exclude<keyof SiteContent, "logoData">,
    number,
  ][]) {
    const field = input[key];
    if (field === undefined) continue;
    if (typeof field !== "string" || field.trim().length > limit) return null;
    parsed[key] = field.trim();
  }

  if (parsed.footerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.footerEmail)) return null;

  const logoData = input.logoData;
  if (logoData === null || logoData === undefined || logoData === "") {
    parsed.logoData = null;
  } else if (
    typeof logoData === "string" &&
    logoData.length <= 400_000 &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logoData)
  ) {
    parsed.logoData = logoData;
  } else {
    return null;
  }

  return parsed;
}
