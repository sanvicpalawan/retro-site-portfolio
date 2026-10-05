export const SITE_LINK_KINDS = [
  "development",
  "staging",
  "live",
  "backend",
  "database",
  "github",
  "vercel",
  "docs",
  "other",
] as const;

export type SiteLinkKind = (typeof SITE_LINK_KINDS)[number];
export type SiteStatus = "in-development" | "live" | "maintenance" | "archived";

export type SiteLinkInput = {
  kind: SiteLinkKind;
  label: string;
  url: string;
};

export type SiteInput = {
  name: string;
  url: string;
  backendUrl: string;
  description: string;
  category: string;
  owner: string;
  status: SiteStatus;
  techStack: string;
  notes: string;
  links: SiteLinkInput[];
};

const SITE_STATUSES: readonly SiteStatus[] = ["in-development", "live", "maintenance", "archived"];
const MAX_SITE_LINKS = 25;

function parseHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;

  try {
    const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function boundedText(value: unknown, max: number, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || value.trim().length > max) return null;
  return value.trim();
}

export function parseSiteInput(value: unknown): SiteInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const name = boundedText(candidate.name, 120);
  const description = boundedText(candidate.description, 3000);
  const category = boundedText(candidate.category, 100);
  const owner = boundedText(candidate.owner, 120);
  const techStack = boundedText(candidate.techStack, 400);
  const notes = boundedText(candidate.notes, 6000);
  if (name === null || !name || description === null || category === null || owner === null || techStack === null || notes === null) return null;

  const statusCandidate = candidate.status ?? "in-development";
  if (typeof statusCandidate !== "string" || !SITE_STATUSES.includes(statusCandidate as SiteStatus)) return null;
  const status = statusCandidate as SiteStatus;

  const parsedLinks: SiteLinkInput[] = [];
  if (candidate.links !== undefined) {
    if (!Array.isArray(candidate.links) || candidate.links.length > MAX_SITE_LINKS) return null;
    for (const rawLink of candidate.links) {
      if (!rawLink || typeof rawLink !== "object") return null;
      const link = rawLink as Record<string, unknown>;
      const rawUrl = typeof link.url === "string" ? link.url.trim() : "";
      if (!rawUrl) continue;
      const url = parseHttpUrl(rawUrl);
      const label = boundedText(link.label, 100);
      const kind = typeof link.kind === "string" && SITE_LINK_KINDS.includes(link.kind as SiteLinkKind)
        ? link.kind as SiteLinkKind
        : null;
      if (!url || label === null || !label || !kind) return null;
      parsedLinks.push({ kind, label, url });
    }
  }

  const legacyUrl = typeof candidate.url === "string" ? candidate.url.trim() : "";
  const primaryLink = parsedLinks.find((link) => link.kind === "live")
    ?? parsedLinks.find((link) => link.kind === "development")
    ?? parsedLinks[0];
  const url = primaryLink?.url ?? parseHttpUrl(legacyUrl);
  if (!url) return null;

  if (parsedLinks.length === 0) {
    parsedLinks.push({ kind: "live", label: "Primary site", url });
  }

  // The backend/API endpoint can be supplied directly, or picked up from a
  // link row that the admin marked as "Backend / API".
  const rawBackendUrl = typeof candidate.backendUrl === "string" ? candidate.backendUrl.trim() : "";
  const backendLink = parsedLinks.find((link) => link.kind === "backend");
  let backendUrl = "";
  if (rawBackendUrl) {
    const parsedBackendUrl = parseHttpUrl(rawBackendUrl);
    if (!parsedBackendUrl) return null;
    backendUrl = parsedBackendUrl;
  } else if (backendLink) {
    backendUrl = backendLink.url;
  }

  if (backendUrl && !backendLink) {
    parsedLinks.push({ kind: "backend", label: "Backend / API", url: backendUrl });
  }

  return {
    name,
    url,
    backendUrl,
    description,
    category,
    owner,
    status,
    techStack,
    notes,
    links: parsedLinks,
  };
}
