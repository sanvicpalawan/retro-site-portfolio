"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FooterLinkRecord, SiteDirectoryEntry, SiteImageSummary, SiteMediaSummary } from "@/db/schema";
import SiteEditor from "@/components/site-editor";
import SiteFooter from "@/components/site-footer";
import FooterEditor from "@/components/footer-editor";
import ImageViewer, { type ViewerImage } from "@/components/image-viewer";
import { DEFAULT_SITE_CONTENT, type SiteContent } from "@/lib/site-content";
import type { FooterLinkInput } from "@/lib/footer-links";
import type { SiteInput } from "@/lib/site-validation";

type DashboardProps = {
  initialSites: SiteDirectoryEntry[];
  initialContent: SiteContent;
  initialMedia: SiteMediaSummary[];
  initialFooterLinks: FooterLinkRecord[];
};

type EditorState = { mode: "create" } | { mode: "edit"; site: SiteDirectoryEntry } | null;
type ViewerState = { images: ViewerImage[]; index: number; label: string } | null;
type ClockProps = { label: string; city: string; timeZone: string; now: Date | null };

type ApiError = { error?: string };

const ADMIN_STORAGE_KEY = "palawan-collective-admin-session-v2";

function storeAdminSession(token: string) {
  try {
    window.localStorage.setItem(ADMIN_STORAGE_KEY, token);
  } catch {
    // The secure cookie remains a fallback when browser storage is unavailable.
  }
}

function clearStoredAdminSession() {
  try {
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

const colorSwatches = [
  "bg-[#102112] text-[#adff8b]",
  "bg-[#122716] text-[#9eeb83]",
  "bg-[#17331a] text-[#b9f797]",
  "bg-[#0e2012] text-[#8fda79]",
  "bg-[#19371d] text-[#c0ff9a]",
  "bg-[#132a16] text-[#a7e98a]",
];

function BrandMark({ logoData }: { logoData: string | null }) {
  if (logoData) {
    return <img src={logoData} alt="" className="h-11 w-11 shrink-0 object-contain" />;
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 44 44" className="h-11 w-11 shrink-0">
      <rect x="2" y="3" width="40" height="31" rx="5" fill="#111712" stroke="#64ed78" strokeWidth="1.5" />
      <rect x="6" y="7" width="32" height="23" rx="2" fill="#071108" />
      <path d="M10 24h5l3-7 4 9 4-6 2 4h6" fill="none" stroke="#a5ff86" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="1.8" />
      <path d="M22 34v4m-7 2h14" stroke="#64ed78" strokeLinecap="square" strokeWidth="2" />
      <circle cx="37" cy="35" r="1.2" fill="#a5ff86" />
    </svg>
  );
}

function Clock({ label, city, timeZone, now }: ClockProps) {
  const time = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now)
    : "--:--:-- --";
  const date = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(now)
    : "Loading date";
  const zone = now
    ? new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value
    : "";

  return (
    <div className="min-w-[116px] rounded-2xl bg-white/75 px-3 py-2.5 shadow-[0_2px_12px_rgba(26,50,38,0.04)] sm:min-w-[140px] sm:px-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#849189]">{label}</span>
        <span className="rounded-md bg-[#edf3ee] px-1.5 py-0.5 text-[9px] font-semibold text-[#48705a]">{zone || "LOCAL"}</span>
      </div>
      <div className="mt-1 font-mono text-[14px] font-semibold tabular-nums tracking-[-0.04em] text-[#1e3428] sm:text-[15px]">
        {time}
      </div>
      <div className="mt-0.5 text-[10px] text-[#849189]">{city} <span className="px-0.5 text-[#b5c0b8]">·</span> {date}</div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none">
      <circle cx="8.8" cy="8.8" r="5.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13 13 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4" fill="none">
      <path d="M5 13 13 5M6 5h7v7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-3.5 w-3.5" fill="none">
      <path d="m11.9 3.1 3 3M4 14l2.5-.5 8-8a1.5 1.5 0 0 0-2.1-2.1l-8 8L4 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-3.5 w-3.5" fill="none">
      <path d="M3.5 5h11M7 5V3.5h4V5m2.7 0-.6 9H4.9l-.6-9m3.1 2.5v4m3.2-4v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function domainFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function optimizeImage(file: File, maxSide: number, maxBytes: number) {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    throw new Error("Choose an image file smaller than 15 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image could not be opened. Try a PNG, JPEG, or WebP image.");
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare that image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.84, 0.72, 0.58, 0.46]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= maxBytes) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the image."));
          reader.onerror = () => reject(new Error("Could not read the image."));
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error("This image is still too large after compression. Choose a smaller image.");
  } finally {
    bitmap.close();
  }
}

function ContentEditor({
  initialContent,
  onClose,
  onSave,
}: {
  initialContent: SiteContent;
  onClose: () => void;
  onSave: (content: SiteContent) => Promise<void>;
}) {
  const [content, setContent] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState("");

  function setTextField(key: Exclude<keyof SiteContent, "logoData">, value: string) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  async function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setLogoBusy(true);
    setError("");
    try {
      const logoData = await optimizeImage(file, 640, 260_000);
      setContent((current) => ({ ...current, logoData }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare that logo.");
    } finally {
      setLogoBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(content);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save page content.");
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "mt-1.5 min-h-10 w-full rounded-[3px] border border-[#385d39] bg-[#040a05] px-3 py-2 text-xs leading-5 text-[#c4ff9b] outline-none placeholder:text-[#5f7959] focus:border-[#78a965]";
  const labelClass = "block text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a2c493]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="content-editor-title" className="modal-in my-auto max-h-[92vh] w-full max-w-[650px] overflow-y-auto rounded-[4px] border border-[#49744a] bg-[#0b150c] p-5 text-[#b7ff8a] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9bc28d]">ADMIN · PAGE SETTINGS</p>
            <h2 id="content-editor-title" className="mt-2 text-xl font-bold uppercase text-[#c1ff95]">Edit your homepage</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#88a57e]">Changes are saved to the collective’s database and shown to everyone.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close editor" className="grid h-9 w-9 shrink-0 place-items-center border border-[#344a34] bg-[#131a13] text-lg text-[#8ba27e]">×</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="rounded border border-[#29452c] bg-[#08110a] p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-[#3f6b41] bg-[#050905] p-2">
                {content.logoData ? <img src={content.logoData} alt="Logo preview" className="max-h-full max-w-full object-contain" /> : <BrandMark logoData={null} />}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-9 cursor-pointer items-center border border-[#3c5d3d] bg-[#101b11] px-3 text-[10px] font-semibold uppercase text-[#a7dc8b] hover:bg-[#17261a]">
                  {logoBusy ? "Preparing…" : content.logoData ? "Replace logo" : "Upload logo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={logoBusy} onChange={chooseLogo} className="sr-only" />
                </label>
                {content.logoData && <button type="button" onClick={() => setContent((current) => ({ ...current, logoData: null }))} className="min-h-9 border border-[#76433a] bg-[#28140f] px-3 text-[10px] font-semibold uppercase text-[#ffc0a8]">Remove logo</button>}
              </div>
              <p className="w-full text-[10px] leading-5 text-[#789373]">Choose a logo from your device. It is automatically resized and stored with your site settings.</p>
            </div>
          </div>

          <label className={labelClass}>Small badge text
            <input maxLength={80} value={content.badgeText} onChange={(event) => setTextField("badgeText", event.target.value)} className={fieldClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Main headline
              <input maxLength={120} value={content.heroHeading} onChange={(event) => setTextField("heroHeading", event.target.value)} className={fieldClass} />
            </label>
            <label className={labelClass}>Highlighted headline
              <input maxLength={120} value={content.heroHighlight} onChange={(event) => setTextField("heroHighlight", event.target.value)} className={fieldClass} />
            </label>
          </div>
          <label className={labelClass}>Homepage description
            <textarea rows={3} maxLength={600} value={content.heroDescription} onChange={(event) => setTextField("heroDescription", event.target.value)} className={fieldClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Links section heading
              <input maxLength={120} value={content.collectionHeading} onChange={(event) => setTextField("collectionHeading", event.target.value)} className={fieldClass} />
            </label>
            <label className={labelClass}>Links section description
              <input maxLength={300} value={content.collectionDescription} onChange={(event) => setTextField("collectionDescription", event.target.value)} className={fieldClass} />
            </label>
          </div>
          <label className={labelClass}>Footer text
            <input maxLength={300} value={content.aboutText} onChange={(event) => setTextField("aboutText", event.target.value)} className={fieldClass} />
          </label>
          <button type="button" onClick={() => setContent(DEFAULT_SITE_CONTENT)} className="min-h-8 border border-[#3c5d3d] bg-[#101b11] px-3 text-[9px] font-semibold uppercase text-[#91b481]">Reset copy and logo to defaults</button>

          {error && <p role="alert" className="border border-[#76433a] bg-[#28140f] p-3 text-[11px] leading-5 text-[#ffc0a8]">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#29452c] pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="min-h-10 border border-[#3c5d3d] bg-[#101b11] px-4 text-[10px] font-semibold uppercase text-[#a7dc8b]">Cancel</button>
            <button type="submit" disabled={busy || logoBusy} className="min-h-10 border border-[#6ba259] bg-[#17361b] px-5 text-[10px] font-bold uppercase text-[#d6ffc0] disabled:opacity-50">{busy ? "Saving…" : "Save page changes"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}


function PasskeyDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (sessionToken: string) => void;
}) {
  const [passkey, setPasskey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey }),
      });
      const result = (await response.json()) as ApiError & { authenticated?: boolean; sessionToken?: string };
      if (!response.ok || !result.authenticated || !result.sessionToken) {
        throw new Error(result.error || "Unable to start an admin session. Please try again.");
      }
      onSuccess(result.sessionToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
      setPasskey("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#10251c]/45 p-4 backdrop-blur-[3px]" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="passkey-title" className="modal-in w-full max-w-[420px] rounded-[28px] bg-white p-6 shadow-[0_28px_90px_rgba(13,38,25,0.24)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e9f2ec] text-[#286247]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <rect x="4.5" y="10" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            </svg>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="grid h-9 w-9 place-items-center rounded-full bg-[#f1f5f1] text-[#68776e] transition hover:bg-[#e7eee8] disabled:opacity-50"><span aria-hidden="true" className="text-xl leading-none">×</span></button>
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-[#688271]">PALAWAN COLLECTIVE OS</p>
        <h2 id="passkey-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1d2e24]">Admin access</h2>
        <p className="mt-2 text-sm leading-6 text-[#78857d]">Enter your passkey to manage the collective’s saved sites.</p>
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="admin-passkey" className="mb-2 block text-xs font-semibold text-[#304338]">Passkey</label>
          <input id="admin-passkey" autoFocus required type="password" inputMode="numeric" autoComplete="current-password" value={passkey} onChange={(event) => setPasskey(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Enter passkey" className="h-12 w-full rounded-xl bg-[#f5f8f5] px-4 text-center font-mono text-lg tracking-[0.35em] text-[#1d2e24] outline-none ring-1 ring-inset ring-[#e6ece7] placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-[#a0aaa2] focus:bg-white focus:ring-2 focus:ring-[#83ab91]" />
          {error && <p role="alert" className="mt-3 rounded-xl bg-[#fff1ef] px-3.5 py-3 text-xs leading-5 text-[#a4483e]">{error}</p>}
          <button type="submit" disabled={busy || !passkey} className="mt-5 h-12 w-full rounded-xl bg-[#205b46] text-sm font-semibold text-white shadow-[0_5px_12px_rgba(32,91,70,0.16)] transition hover:bg-[#194c3a] disabled:cursor-not-allowed disabled:opacity-55">{busy ? "Checking…" : "Unlock admin tools"}</button>
        </form>
      </section>
    </div>
  );
}

export default function CollectiveDashboard({ initialSites, initialContent, initialMedia, initialFooterLinks }: DashboardProps) {
  const [savedSites, setSavedSites] = useState(initialSites);
  const [content, setContent] = useState(initialContent);
  const [media, setMedia] = useState(initialMedia);
  const [footerItems, setFooterItems] = useState(initialFooterLinks);
  const [footerEditorOpen, setFooterEditorOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSession, setAdminSession] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [contentEditorOpen, setContentEditorOpen] = useState(false);
  const [passkeyOpen, setPasskeyOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<SiteDirectoryEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [mediaAltText, setMediaAltText] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [toast, setToast] = useState("");
  const [viewer, setViewer] = useState<ViewerState>(null);
  const logoClicks = useRef<number[]>([]);
  const mediaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Start at null (server render) and hydrate the clocks on the next tick
    // to avoid a hydration mismatch, then keep them ticking every second.
    const timeout = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let savedSession = "";
    try {
      savedSession = window.localStorage.getItem(ADMIN_STORAGE_KEY) ?? "";
    } catch {
      // Fall back to the secure HTTP-only cookie when local storage is disabled.
    }

    fetch("/api/admin/auth", {
      cache: "no-store",
      headers: savedSession ? { Authorization: `Bearer ${savedSession}` } : {},
    })
      .then((response) => response.json())
      .then((result: { authenticated?: boolean; sessionToken?: string | null }) => {
        if (!active) return;
        if (result.authenticated && result.sessionToken) {
          setAdminSession(result.sessionToken);
          setIsAdmin(true);
          storeAdminSession(result.sessionToken);
        } else {
          setAdminSession("");
          setIsAdmin(false);
          clearStoredAdminSession();
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredSites = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return savedSites;
    return savedSites.filter((site) => [
      site.name,
      site.description,
      site.category,
      site.owner,
      site.status,
      site.techStack,
      site.notes,
      ...site.links.map((link) => `${link.kind} ${link.label} ${link.url}`),
    ].join(" ").toLocaleLowerCase().includes(needle));
  }, [savedSites, search]);

  const projectImages = useMemo(() => {
    const bySite = new Map<number, ViewerImage[]>();
    for (const site of savedSites) {
      bySite.set(site.id, site.images.map((image) => ({
        src: `/api/sites/${site.id}/images/${image.id}`,
        alt: image.altText || image.filename,
        caption: image.filename,
      })));
    }
    return bySite;
  }, [savedSites]);

  const galleryImages = useMemo<ViewerImage[]>(
    () => media.map((item) => ({
      src: `/api/media/${item.id}`,
      alt: item.altText || item.filename,
      caption: item.filename,
    })),
    [media],
  );

  function handleLogoClick() {
    const current = Date.now();
    const recent = logoClicks.current.filter((time) => current - time < 1100);
    recent.push(current);
    if (recent.length >= 3) {
      logoClicks.current = [];
      setPasskeyOpen(true);
      return;
    }
    logoClicks.current = recent;
  }

  async function saveSite(siteId: number | null, values: SiteInput): Promise<SiteDirectoryEntry> {
    const creating = siteId === null;
    const response = await fetch(creating ? "/api/sites" : `/api/sites/${siteId}`, {
      method: creating ? "POST" : "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(adminSession ? { Authorization: `Bearer ${adminSession}` } : {}),
      },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as (SiteDirectoryEntry & ApiError);
    if (response.status === 401) {
      setIsAdmin(false);
      setAdminSession("");
      clearStoredAdminSession();
      setPasskeyOpen(true);
      throw new Error("Your admin access needs to be restored. Sign in, then save these project details again.");
    }
    if (!response.ok) throw new Error(result.error || "Could not save this project.");

    let saved: SiteDirectoryEntry;
    if (creating) {
      saved = { ...result, images: [] };
      setSavedSites((current) => [...current, saved]);
      setToast("Project created. Its selected images will now upload here.");
    } else {
      const current = savedSites.find((site) => site.id === result.id);
      saved = { ...result, images: current?.images ?? result.images ?? [] };
      setSavedSites((items) => items.map((site) => site.id === saved.id ? saved : site));
      setEditor({ mode: "edit", site: saved });
      setToast("Project details saved for the whole team.");
    }
    return saved;
  }

  async function uploadSiteImage(siteId: number, upload: { filename: string; altText: string; dataUrl: string }): Promise<SiteImageSummary> {
    const response = await fetch(`/api/sites/${siteId}/images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminSession ? { Authorization: `Bearer ${adminSession}` } : {}),
      },
      body: JSON.stringify(upload),
    });
    const result = (await response.json()) as SiteImageSummary & ApiError;
    if (response.status === 401) {
      setIsAdmin(false);
      setAdminSession("");
      clearStoredAdminSession();
      setPasskeyOpen(true);
      throw new Error("Your admin access needs to be restored. Sign in, then select the image again.");
    }
    if (!response.ok) throw new Error(result.error || "Could not upload this project image.");

    setSavedSites((current) => current.map((site) => site.id === siteId
      ? { ...site, images: [...site.images, result] }
      : site));
    setEditor((current) => current?.mode === "edit" && current.site.id === siteId
      ? { mode: "edit", site: { ...current.site, images: [...current.site.images, result] } }
      : current);
    return result;
  }

  async function removeSiteImage(siteId: number, image: SiteImageSummary) {
    const response = await fetch(`/api/sites/${siteId}/images/${image.id}`, {
      method: "DELETE",
      headers: adminSession ? { Authorization: `Bearer ${adminSession}` } : {},
    });
    const result = (await response.json()) as ApiError;
    if (response.status === 401) {
      setIsAdmin(false);
      setAdminSession("");
      clearStoredAdminSession();
      setPasskeyOpen(true);
      throw new Error("Your admin access needs to be restored. Sign in, then remove the image.");
    }
    if (!response.ok) throw new Error(result.error || "Could not remove this project image.");

    setSavedSites((current) => current.map((site) => site.id === siteId
      ? { ...site, images: site.images.filter((item) => item.id !== image.id) }
      : site));
    setEditor((current) => current?.mode === "edit" && current.site.id === siteId
      ? { mode: "edit", site: { ...current.site, images: current.site.images.filter((item) => item.id !== image.id) } }
      : current);
  }

  function handleUnauthorized(message: string) {
    setIsAdmin(false);
    setAdminSession("");
    clearStoredAdminSession();
    setPasskeyOpen(true);
    return new Error(message);
  }

  async function createFooterLink(input: FooterLinkInput): Promise<FooterLinkRecord> {
    const response = await fetch("/api/footer-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminSession ? { Authorization: `Bearer ${adminSession}` } : {}),
      },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as FooterLinkRecord & ApiError;
    if (response.status === 401) throw handleUnauthorized("Sign in again, then add this footer link.");
    if (!response.ok) throw new Error(result.error || "Could not add this footer link.");
    setFooterItems((current) => [...current, result].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id));
    setToast("Footer link added.");
    return result;
  }

  async function updateFooterLink(id: number, input: FooterLinkInput): Promise<FooterLinkRecord> {
    const response = await fetch(`/api/footer-links/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(adminSession ? { Authorization: `Bearer ${adminSession}` } : {}),
      },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as FooterLinkRecord & ApiError;
    if (response.status === 401) throw handleUnauthorized("Sign in again, then save this footer link.");
    if (!response.ok) throw new Error(result.error || "Could not update this footer link.");
    setFooterItems((current) => current
      .map((link) => link.id === id ? result : link)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id));
    setToast("Footer link updated.");
    return result;
  }

  async function deleteFooterLink(link: FooterLinkRecord) {
    const response = await fetch(`/api/footer-links/${link.id}`, {
      method: "DELETE",
      headers: adminSession ? { Authorization: `Bearer ${adminSession}` } : {},
    });
    const result = (await response.json()) as ApiError;
    if (response.status === 401) throw handleUnauthorized("Sign in again, then delete this footer link.");
    if (!response.ok) throw new Error(result.error || "Could not delete this footer link.");
    setFooterItems((current) => current.filter((item) => item.id !== link.id));
    setToast("Footer link deleted.");
  }

  async function saveContent(nextContent: SiteContent, options?: { keepOpen?: boolean }) {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(adminSession ? { Authorization: `Bearer ${adminSession}` } : {}),
      },
      body: JSON.stringify(nextContent),
    });
    const result = (await response.json()) as SiteContent & ApiError;
    if (response.status === 401) {
      throw handleUnauthorized("Please unlock admin again in the sign-in window, then save once more. Your edits are still here.");
    }
    if (!response.ok) throw new Error(result.error || "Could not save page settings.");
    setContent(result);
    if (!options?.keepOpen) {
      setContentEditorOpen(false);
      setToast("Homepage text and logo saved for everyone.");
    } else {
      setToast("Footer details saved for everyone.");
    }
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setMediaBusy(true);
    setMediaError("");
    try {
      const dataUrl = await optimizeImage(file, 1600, 900_000);
      const response = await fetch("/api/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSession ? { Authorization: `Bearer ${adminSession}` } : {}),
        },
        body: JSON.stringify({ filename: file.name, altText: mediaAltText.trim() || file.name, dataUrl }),
      });
      const result = (await response.json()) as SiteMediaSummary & ApiError;
      if (response.status === 401) {
        setIsAdmin(false);
        setAdminSession("");
        setPasskeyOpen(true);
        throw new Error("Please unlock admin again, then choose the image once more. Your description has been kept.");
      }
      if (!response.ok) throw new Error(result.error || "Could not upload that image.");
      setMedia((current) => [result, ...current]);
      setMediaAltText("");
      setToast("Image added to the collective gallery.");
    } catch (caught) {
      setMediaError(caught instanceof Error ? caught.message : "Could not upload that image.");
    } finally {
      setMediaBusy(false);
    }
  }

  async function removeMedia(item: SiteMediaSummary) {
    if (!window.confirm(`Remove “${item.filename}” from the gallery?`)) return;
    setMediaError("");
    try {
      const response = await fetch(`/api/media/${item.id}`, {
        method: "DELETE",
        headers: adminSession ? { Authorization: `Bearer ${adminSession}` } : {},
      });
      const result = (await response.json()) as ApiError;
      if (response.status === 401) {
        setIsAdmin(false);
        setAdminSession("");
        setPasskeyOpen(true);
        throw new Error("Please unlock admin again, then remove the image.");
      }
      if (!response.ok) throw new Error(result.error || "Could not remove that image.");
      setMedia((current) => current.filter((savedImage) => savedImage.id !== item.id));
      setViewer((current) => (current?.label === "Collective images" ? null : current));
      setToast("Image removed from the gallery.");
    } catch (caught) {
      setMediaError(caught instanceof Error ? caught.message : "Could not remove that image.");
    }
  }

  async function deleteSite() {
    if (!siteToDelete) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/sites/${siteToDelete.id}`, {
        method: "DELETE",
        headers: adminSession ? { Authorization: `Bearer ${adminSession}` } : {},
      });
      const result = (await response.json()) as ApiError & { id?: number };
      if (response.status === 401) {
        setIsAdmin(false);
        setAdminSession("");
        clearStoredAdminSession();
        setPasskeyOpen(true);
        throw new Error("Please unlock admin again in the sign-in window, then remove the site.");
      }
      if (!response.ok) throw new Error(result.error || "Could not delete this site.");
      setSavedSites((current) => current.filter((site) => site.id !== siteToDelete.id));
      setToast("Site removed from your collection.");
      setSiteToDelete(null);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "Could not delete this site.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function logOut() {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } finally {
      clearStoredAdminSession();
      setIsAdmin(false);
      setAdminSession("");
      setToast("Admin tools are locked.");
    }
  }

  return (
    <div className="terminal-os min-h-screen bg-[#f5f7f4] text-[#17251f]">
      <header className="sticky top-0 z-30 border-b border-[#e8ede9] bg-[#f7f9f6]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[86px] w-full max-w-[1440px] min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7 lg:flex-nowrap lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={handleLogoClick} title="Click the logo three times for admin access" aria-label="Palawan Collective OS logo — click three times for admin access" className="rounded-[16px] transition duration-200 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c9b7c] focus-visible:ring-offset-2">
              <BrandMark logoData={content.logoData} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold tracking-[-0.03em] text-[#1a3024] sm:text-[15px]">Palawan Collective</div>
              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.17em] text-[#829087]">OS <span className="mx-1 text-[#b4c0b7]">/</span> Link workspace</div>
            </div>
          </div>

          <nav aria-label="Main navigation" className="hidden items-center gap-5 pl-4 text-[12px] font-medium text-[#748178] lg:flex">
            <a href="#collection" className="transition hover:text-[#205b46]">LINKS</a>
            <a href="#gallery" className="transition hover:text-[#205b46]">IMAGES</a>
            <a href="#about" className="transition hover:text-[#205b46]">ABOUT</a>
          </nav>

          <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-2.5">
            <Clock label="LOCAL TIME" city="Manila" timeZone="Asia/Manila" now={now} />
            <Clock label="LOCAL TIME" city="Texas" timeZone="America/Chicago" now={now} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1440px] px-4 pb-12 pt-7 sm:px-7 sm:pt-9 lg:px-10 lg:pt-11">
        <section className="float-in relative isolate min-w-0 overflow-hidden rounded-[28px] bg-[#1c4c39] px-6 py-8 text-white shadow-[0_18px_44px_rgba(26,73,52,0.12)] sm:rounded-[34px] sm:px-10 sm:py-10 lg:min-h-[272px] lg:px-12 lg:py-11">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-24 -top-52 h-[430px] w-[430px] rounded-full border border-white/[0.09]" />
            <div className="absolute -right-4 -top-32 h-[330px] w-[330px] rounded-full border border-white/[0.10]" />
            <div className="absolute right-[11%] top-[20%] h-44 w-44 rounded-full bg-[#b9d5bd]/[0.08] blur-[2px]" />
            <div className="absolute bottom-0 right-0 h-36 w-[48%] bg-gradient-to-t from-[#122f26]/35 to-transparent" />
            <div className="absolute bottom-0 right-[8%] h-32 w-[37%] rounded-t-[100%] bg-[#a9c5ad]/[0.10]" />
            <div className="absolute bottom-0 right-[31%] h-20 w-[32%] rounded-t-[100%] bg-[#d6e5d7]/[0.08]" />
            <div className="absolute right-[25%] top-[23%] h-2 w-2 rounded-full bg-[#e1eee1]/80" />
            <div className="absolute right-[11%] top-[43%] h-1.5 w-1.5 rounded-full bg-[#e1eee1]/55" />
          </div>

          <div className="relative max-w-[650px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.10] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.17em] text-[#d5e7d8] ring-1 ring-inset ring-white/[0.10]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#91c39c] shadow-[0_0_9px_rgba(145,195,156,0.85)]" />
              {content.badgeText || "\u00a0"}
            </div>
            <h1 className="mt-5 max-w-[620px] break-words text-[clamp(2.1rem,5vw,3.55rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-white">
              {content.heroHeading} <span className="text-[#c4ddc8]">{content.heroHighlight}</span>
            </h1>
            <p className="mt-4 max-w-[480px] whitespace-pre-line text-[13px] leading-6 text-[#d4e1d6] sm:text-[14px]">
              {content.heroDescription}
            </p>
          </div>

          <div className="relative mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.13] pt-5 lg:absolute lg:bottom-10 lg:right-11 lg:mt-0 lg:border-0 lg:pt-0">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-white/[0.12] text-[#d9eadb]">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none"><circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" /><path d="M3.8 10h12.4M10 3.5c1.6 1.8 2.3 4 2.3 6.5s-.7 4.7-2.3 6.5C8.4 14.7 7.7 12.5 7.7 10s.7-4.7 2.3-6.5Z" stroke="currentColor" strokeWidth="1.2" /></svg>
              </span>
              <div>
                <div className="font-mono text-[17px] font-semibold leading-none tabular-nums">{String(savedSites.length).padStart(2, "0")}</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#c1d4c4]">Projects</div>
              </div>
            </div>
            <div className="hidden h-8 w-px bg-white/15 sm:block" />
            <div className="text-[10px] font-medium leading-5 text-[#c1d4c4]">
              {isAdmin ? "Admin tools unlocked" : "A shared space for your favorite links"}
            </div>
          </div>
        </section>

        {(media.length > 0 || isAdmin) && (
          <section id="gallery" className="terminal-gallery mt-7 min-w-0 scroll-mt-28 border border-[#2e5232] bg-[#09130b] p-4 shadow-[inset_0_0_25px_rgba(87,207,74,0.04)] sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.19em] text-[#83ac79]"><span className="h-px w-5 bg-[#52734b]" /> THE PINBOARD</div>
                <h2 className="mt-2.5 text-[22px] font-bold uppercase tracking-[-0.04em] text-[#bdff91]">Collective images</h2>
                <p className="mt-1.5 text-[11px] leading-5 text-[#819779]">A shared wall for the images that belong in this space. {media.length} / 12 saved.</p>
              </div>
              {isAdmin && (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[390px] sm:flex-row sm:items-center">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Describe this image</span>
                    <input value={mediaAltText} onChange={(event) => setMediaAltText(event.target.value)} maxLength={180} placeholder="Optional image description" className="h-10 w-full border border-[#315537] bg-[#071008] px-3 text-[10px] text-[#b9f797] placeholder:text-[#688063] focus:border-[#73a85b] focus:outline-none" />
                  </label>
                  <input ref={mediaInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadMedia} disabled={mediaBusy || media.length >= 12} className="sr-only" aria-label="Choose image from device" />
                  <button type="button" onClick={() => mediaInput.current?.click()} disabled={mediaBusy || media.length >= 12} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 border border-[#6ba259] bg-[#17361b] px-4 text-[10px] font-bold uppercase text-[#d6ffc0] disabled:cursor-not-allowed disabled:opacity-50">
                    <AddIcon /> {mediaBusy ? "Preparing image…" : media.length >= 12 ? "Gallery full" : "Upload from device"}
                  </button>
                </div>
              )}
            </div>

            {mediaError && <p role="alert" className="mt-4 border border-[#76433a] bg-[#28140f] p-3 text-[10px] leading-5 text-[#ffc0a8]">{mediaError}</p>}

            {media.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {media.map((item, itemIndex) => (
                  <figure key={item.id} className="group relative m-0 overflow-hidden border border-[#315537] bg-[#071008]">
                    <button
                      type="button"
                      onClick={() => setViewer({ images: galleryImages, index: itemIndex, label: "Collective images" })}
                      aria-haspopup="dialog"
                      title={`View ${item.altText || item.filename} full screen`}
                      className="image-thumb block w-full cursor-zoom-in overflow-hidden"
                    >
                      <span className="sr-only">View {item.altText || item.filename} full screen</span>
                      <img src={`/api/media/${item.id}`} alt={item.altText || item.filename} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
                    </button>
                    <figcaption className="flex min-h-9 items-center justify-between gap-2 border-t border-[#29452c] px-3 py-2 text-[9px] text-[#88a77e]">
                      <span className="truncate">{item.altText || item.filename}</span>
                      {isAdmin && <button type="button" onClick={() => void removeMedia(item)} aria-label={`Remove ${item.filename}`} className="shrink-0 border border-[#76433a] bg-[#28140f] px-2 py-1 text-[9px] font-semibold uppercase text-[#ffc0a8]">Remove</button>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mt-5 border border-dashed border-[#315537] px-5 py-8 text-center text-[10px] leading-5 text-[#789373]">Choose a photo or image from your device to start the shared pinboard.</div>
            )}
          </section>
        )}

        <section id="collection" className="min-w-0 scroll-mt-28 pt-10 sm:pt-12">
          <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.19em] text-[#6c8b76]">
                <span className="h-px w-5 bg-[#83a58c]" /> DEVELOPERS · PROJECTS
              </div>
              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-[27px] font-semibold tracking-[-0.045em] text-[#203328] sm:text-[30px]">{content.collectionHeading}</h2>
                 <span className="text-[12px] text-[#8b978f]">{savedSites.length} {savedSites.length === 1 ? "project" : "projects"}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-6 text-[#7d8981]">{content.collectionDescription}</p>
            </div>

            <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
              <label className="relative block w-full min-w-0 sm:w-[248px] sm:shrink-0">
                <span className="sr-only">Search your sites</span>
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#87958b]"><SearchIcon /></span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Find a favorite…" className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-[12px] text-[#26372d] shadow-[0_2px_10px_rgba(30,61,42,0.035)] outline-none ring-1 ring-inset ring-[#e6ece7] placeholder:text-[#a0aaa2] focus:ring-2 focus:ring-[#91b19a]" />
              </label>
              {isAdmin ? (
                <>
                  <button type="button" onClick={() => setContentEditorOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#102112] px-3.5 text-[10px] font-semibold uppercase text-[#a7ed89]">
                    Edit homepage
                  </button>
                  <button type="button" onClick={() => setFooterEditorOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#102112] px-3.5 text-[10px] font-semibold uppercase text-[#a7ed89]">
                    Edit footer
                  </button>
                  <button type="button" onClick={() => setEditor({ mode: "create" })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#205b46] px-4 text-[12px] font-semibold text-white shadow-[0_5px_12px_rgba(32,91,70,0.14)] transition hover:-translate-y-0.5 hover:bg-[#194c3a]">
                    <AddIcon /> Add a site
                  </button>
                  <button type="button" onClick={logOut} className="h-11 rounded-xl px-3 text-[11px] font-semibold uppercase text-[#8eaa83] transition hover:bg-white hover:text-[#354b3d]">Lock admin</button>
                </>
              ) : (
                <button type="button" onClick={() => setPasskeyOpen(true)} title="Or click the logo three times" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#102112] px-3.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#a7ed89] shadow-[0_2px_10px_rgba(30,61,42,0.035)] ring-1 ring-inset ring-[#315537]">
                  <svg aria-hidden="true" viewBox="0 0 18 18" className="h-3.5 w-3.5" fill="none"><rect x="3.5" y="7.5" width="11" height="8" rx="1.7" stroke="currentColor" strokeWidth="1.3" /><path d="M6 7.5V5.7a3 3 0 0 1 6 0v1.8" stroke="currentColor" strokeWidth="1.3" /></svg>
                  Admin sign in
                </button>
              )}
            </div>
          </div>

          {filteredSites.length > 0 ? (
            <div className="mt-7 grid min-w-0 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSites.map((site, index) => {
                const siteViewerImages = projectImages.get(site.id) ?? [];
                return (
                  <article key={site.id} className="group flex min-h-[260px] min-w-0 flex-col rounded-[22px] bg-white p-5 shadow-[0_4px_20px_rgba(27,57,37,0.035)] ring-1 ring-inset ring-[#e8ede9] transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(27,57,37,0.08)] hover:ring-[#d9e5db] sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <a href={site.url} target="_blank" rel="noreferrer" aria-label={`Open primary ${site.name} site`} className="flex min-w-0 flex-1 items-start gap-3.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#6c9b7c]">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[16px] text-[17px] font-semibold tracking-[-0.04em] ${colorSwatches[index % colorSwatches.length]}`}>
                          {site.name.trim().charAt(0).toLocaleUpperCase() || "↗"}
                        </span>
                        <span className="min-w-0 flex-1 pt-0.5">
                          <span className="block truncate text-[13px] font-semibold uppercase tracking-[0.025em] text-[#c3ff98]">{site.name}</span>
                          <span className="mt-1 block truncate text-[9px] text-[#789574]">{site.category || domainFor(site.url)}</span>
                        </span>
                      </a>
                      <span data-status={site.status} className="project-status shrink-0 border px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.045em]">
                        {site.status.replaceAll("-", " ")}
                      </span>
                    </div>

                    {site.description && <p className="mt-3 line-clamp-2 text-[10px] leading-[1.65] text-[#91aa87]">{site.description}</p>}
                    {(site.owner || site.techStack) && (
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[8px] uppercase tracking-[0.035em] text-[#708b68]">
                        {site.owner && <span><span className="text-[#8db781]">OWNER</span> {site.owner}</span>}
                        {site.techStack && <span className="max-w-full truncate"><span className="text-[#8db781]">STACK</span> {site.techStack}</span>}
                      </div>
                    )}
                    {site.backendUrl && (
                      <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[8px] uppercase tracking-[0.035em] text-[#708b68]">
                        <span className="shrink-0 text-[#8db781]">BACKEND</span>
                        <a href={site.backendUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate normal-case text-[#a3cd8d] underline-offset-2 hover:underline">{site.backendUrl}</a>
                      </p>
                    )}

                    <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                      {site.links.map((link) => (
                        <a key={link.id || `${link.kind}-${link.url}`} data-link-kind={link.kind} href={link.url} target="_blank" rel="noreferrer" title={`${link.label}: ${link.url}`} className="developer-link flex min-h-9 min-w-0 items-center justify-between gap-2 border px-2.5 py-1.5 text-[8px] uppercase transition">
                          <span className="min-w-0">
                            <span className="block truncate font-bold tracking-[0.06em]">{link.label}</span>
                            <span className="mt-0.5 block truncate normal-case text-[#71896b]">{domainFor(link.url)}</span>
                          </span>
                          <ArrowIcon />
                        </a>
                      ))}
                    </div>

                    {site.images.length > 0 && (
                      <div className="mt-3 flex gap-1.5 overflow-hidden">
                        {site.images.slice(0, 4).map((image, imageIndex) => (
                          <button
                            key={image.id}
                            type="button"
                            onClick={() => setViewer({ images: siteViewerImages, index: imageIndex, label: site.name })}
                            aria-haspopup="dialog"
                            title={`View ${image.altText || image.filename} full screen`}
                            className="image-thumb block h-12 w-[68px] shrink-0 cursor-zoom-in overflow-hidden"
                          >
                            <span className="sr-only">View {image.altText || image.filename} full screen</span>
                            <img src={`/api/sites/${site.id}/images/${image.id}`} alt={image.altText || image.filename} loading="lazy" className="h-full w-full object-cover transition group-hover:opacity-90" />
                          </button>
                        ))}
                        {site.images.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setViewer({ images: siteViewerImages, index: 4, label: site.name })}
                            aria-haspopup="dialog"
                            title={`View all ${site.images.length} images for ${site.name}`}
                            className="image-thumb image-thumb-more grid h-12 min-w-10 cursor-zoom-in place-items-center px-2 text-[9px]"
                          >
                            +{site.images.length - 4}
                          </button>
                        )}
                      </div>
                    )}

                    {site.notes && <details className="mt-3 border-t border-[#233d27] pt-2.5">
                      <summary className="cursor-pointer text-[8px] font-bold uppercase tracking-[0.08em] text-[#86aa78]">Developer handoff notes</summary>
                      <p className="mt-2 whitespace-pre-wrap break-words text-[9px] leading-5 text-[#849d7b]">{site.notes}</p>
                    </details>}

                    {isAdmin && (
                      <div className="mt-auto flex flex-wrap items-center justify-end gap-1 border-t border-[#edf1ee] pt-3">
                        <span className="mr-auto w-full min-w-0 text-[8px] uppercase tracking-[0.06em] text-[#71896b] sm:w-auto">{site.links.length} link{site.links.length === 1 ? "" : "s"} · {site.images.length} image{site.images.length === 1 ? "" : "s"}</span>
                        <button type="button" onClick={() => setEditor({ mode: "edit", site })} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-semibold uppercase text-[#8db781] transition hover:bg-[#102112] hover:text-[#c2ff9a]"><EditIcon /> Manage</button>
                        <button type="button" onClick={() => setSiteToDelete(site)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-semibold uppercase text-[#bb897b] transition hover:bg-[#21120f] hover:text-[#ffc0a8]"><DeleteIcon /> Delete</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 rounded-[24px] bg-white px-6 py-12 text-center shadow-[0_4px_20px_rgba(27,57,37,0.03)] ring-1 ring-inset ring-[#e8ede9] sm:py-16">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-[19px] bg-[#eaf2ec] text-[#4e7b5d]">
                {search ? <SearchIcon /> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M6.5 4.5h8l3 3v12h-11v-15Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" /><path d="M14.5 4.5v4h4m-9 4h5m-5 3h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>}
              </div>
              <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.03em] text-[#26382d]">{search ? "No matching places" : "Your collection starts here"}</h3>
              <p className="mx-auto mt-2 max-w-[370px] text-[12px] leading-6 text-[#87938b]">
                {search
                  ? "Try another project name, environment, repository URL, or owner."
                  : isAdmin
                    ? "Add the sites your team returns to, and they’ll be waiting here next time."
                     : "Save the links your collective comes back to. Use Admin sign in to manage this space."}
              </p>
              {isAdmin && !search && <button type="button" onClick={() => setEditor({ mode: "create" })} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#205b46] px-4 text-[11px] font-semibold text-white transition hover:bg-[#194c3a]"><AddIcon /> Add your first project</button>}
            </div>
          )}
        </section>

        <SiteFooter
          content={content}
          links={footerItems}
          isAdmin={isAdmin}
          onManage={() => setFooterEditorOpen(true)}
        />
      </main>

      {editor && (
        <SiteEditor
          key={editor.mode === "create" ? "new-project" : `project-${editor.site.id}`}
          editor={editor}
          onClose={() => setEditor(null)}
          onSave={saveSite}
          onUploadImage={uploadSiteImage}
          onRemoveImage={removeSiteImage}
          onNeedAuth={() => setPasskeyOpen(true)}
        />
      )}
      {contentEditorOpen && <ContentEditor initialContent={content} onClose={() => setContentEditorOpen(false)} onSave={saveContent} />}
      {footerEditorOpen && (
        <FooterEditor
          content={content}
          links={footerItems}
          onClose={() => setFooterEditorOpen(false)}
          onSaveDetails={async (nextContent) => { await saveContent(nextContent, { keepOpen: true }); }}
          onCreateLink={createFooterLink}
          onUpdateLink={updateFooterLink}
          onDeleteLink={deleteFooterLink}
        />
      )}
      {siteToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#10251c]/45 p-4 backdrop-blur-[3px]" onMouseDown={(event) => event.target === event.currentTarget && !deleteBusy && setSiteToDelete(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-title" className="modal-in w-full max-w-[410px] rounded-[26px] bg-white p-6 shadow-[0_28px_90px_rgba(13,38,25,0.24)] sm:p-7">
            <div className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#fff1ef] text-[#aa5147]"><DeleteIcon /></div>
            <h2 id="delete-title" className="mt-5 text-xl font-semibold tracking-[-0.035em] text-[#26382d]">Remove this site?</h2>
            <p className="mt-2 text-sm leading-6 text-[#78857d]"><span className="font-semibold text-[#405147]">{siteToDelete.name}</span> will be removed from your collective’s saved places.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={deleteBusy} onClick={() => setSiteToDelete(null)} className="h-10 rounded-xl px-4 text-sm font-semibold text-[#66746b] transition hover:bg-[#f4f7f4]">Keep it</button>
              <button type="button" disabled={deleteBusy} onClick={deleteSite} className="h-10 rounded-xl bg-[#a94e44] px-4 text-sm font-semibold text-white transition hover:bg-[#913f37] disabled:opacity-60">{deleteBusy ? "Removing…" : "Remove site"}</button>
            </div>
          </section>
        </div>
      )}
      {passkeyOpen && (
        <PasskeyDialog
          onClose={() => setPasskeyOpen(false)}
          onSuccess={(sessionToken) => {
            setPasskeyOpen(false);
            setAdminSession(sessionToken);
            storeAdminSession(sessionToken);
            setIsAdmin(true);
            setToast("Admin tools unlocked. You can keep managing the site without signing in again.");
          }}
        />
      )}
      {viewer && (
        <ImageViewer
          images={viewer.images}
          index={viewer.index}
          label={viewer.label}
          onIndexChange={(nextIndex) => setViewer((current) => (current ? { ...current, index: nextIndex } : current))}
          onClose={() => setViewer(null)}
        />
      )}
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#193e30] px-5 py-3 text-center text-[12px] font-medium text-white shadow-[0_12px_35px_rgba(19,55,39,0.24)]">{toast}</div>}
    </div>
  );
}

