export const FOOTER_PLATFORMS = [
  "github",
  "vercel",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "email",
  "docs",
  "link",
] as const;

export const FOOTER_GROUPS = ["social", "resource", "legal"] as const;

export type FooterPlatform = (typeof FOOTER_PLATFORMS)[number];
export type FooterGroup = (typeof FOOTER_GROUPS)[number];

export type FooterLinkInput = {
  platform: FooterPlatform;
  label: string;
  url: string;
  group: FooterGroup;
  sortOrder: number;
};

export const FOOTER_PLATFORM_LABELS: Record<FooterPlatform, string> = {
  github: "GitHub",
  vercel: "Vercel",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  email: "Email",
  docs: "Documentation",
  link: "Website",
};

export const MAX_FOOTER_LINKS = 24;

export function parseFooterLinkInput(value: unknown): FooterLinkInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;

  const platform = typeof input.platform === "string" && FOOTER_PLATFORMS.includes(input.platform as FooterPlatform)
    ? input.platform as FooterPlatform
    : null;
  const group = typeof input.group === "string" && FOOTER_GROUPS.includes(input.group as FooterGroup)
    ? input.group as FooterGroup
    : "social";
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const rawUrl = typeof input.url === "string" ? input.url.trim() : "";
  const sortOrder = Number.isSafeInteger(input.sortOrder) ? Number(input.sortOrder) : 0;

  if (!platform || !label || label.length > 80 || !rawUrl || rawUrl.length > 2048) return null;
  if (sortOrder < 0 || sortOrder > 999) return null;

  let url: string;
  if (platform === "email") {
    const email = rawUrl.replace(/^mailto:/i, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    url = `mailto:${email}`;
  } else {
    try {
      const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      const parsed = new URL(normalized);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      url = parsed.toString();
    } catch {
      return null;
    }
  }

  return { platform, label, url, group, sortOrder };
}
