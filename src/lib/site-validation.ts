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

const LINK_KIND_FALLBACK_LABELS: Record<SiteLinkKind, string> = {
  development: "Development",
  staging: "Staging",
  live: "Live / production",
  backend: "Backend / API",
  database: "Database",
  github: "GitHub repository",
  vercel: "Vercel project",
  docs: "Documentation",
  other: "Other URL",
};

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

/**
 * Lenient text: missing values become "", over-long values are truncated.
 * Nothing here ever fails the save — only a blank project name does.
 */
function lenientText(value: unknown, max: number, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

export function parseSiteInput(value: unknown): SiteInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  // The project name is the only required text field. Every other text
  // field is truncated to its column limit instead of rejecting the save.
  const name = lenientText(candidate.name, 120);
  if (!name) return null;

  const description = lenientText(candidate.description, 3000);
  const category = lenientText(candidate.category, 100);
  const owner = lenientText(candidate.owner, 120);
  const techStack = lenientText(candidate.techStack, 400);
  const notes = lenientText(candidate.notes, 6000);

  const statusCandidate = candidate.status ?? "in-development";
  const status: SiteStatus =
    typeof statusCandidate === "string" && SITE_STATUSES.includes(statusCandidate as SiteStatus)
      ? (statusCandidate as SiteStatus)
      : "in-development";

  // Link rows are forgiving: rows with an empty or unparseable URL are
  // skipped, a missing label falls back to the link type name, and an
  // unknown type falls back to "other". The save only fails when NO
  // usable link remains at all.
  const parsedLinks: SiteLinkInput[] = [];
  if (Array.isArray(candidate.links)) {
    for (const rawLink of candidate.links.slice(0, MAX_SITE_LINKS)) {
      if (!rawLink || typeof rawLink !== "object") continue;
      const link = rawLink as Record<string, unknown>;
      const rawUrl = typeof link.url === "string" ? link.url.trim() : "";
      if (!rawUrl) continue;
      const url = parseHttpUrl(rawUrl);
      if (!url) continue;
      const kind =
        typeof link.kind === "string" && SITE_LINK_KINDS.includes(link.kind as SiteLinkKind)
          ? (link.kind as SiteLinkKind)
          : "other";
      const label = lenientText(link.label, 100, LINK_KIND_FALLBACK_LABELS[kind]);
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

  // An unparseable backend URL is ignored instead of failing the save.
  const rawBackendUrl = typeof candidate.backendUrl === "string" ? candidate.backendUrl.trim() : "";
  const backendLink = parsedLinks.find((link) => link.kind === "backend");
  let backendUrl = "";
  if (rawBackendUrl) {
    backendUrl = parseHttpUrl(rawBackendUrl) ?? "";
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
