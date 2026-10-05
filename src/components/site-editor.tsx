"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import type { SiteDirectoryEntry, SiteImageSummary } from "@/db/schema";
import {
  SITE_LINK_KINDS,
  type SiteInput,
  type SiteLinkKind,
  type SiteStatus,
} from "@/lib/site-validation";

type EditorState = { mode: "create" } | { mode: "edit"; site: SiteDirectoryEntry };
type LinkDraft = { kind: SiteLinkKind; label: string; url: string };
type ApiError = { error?: string };
type UploadResult = { filename: string; altText: string; dataUrl: string };

const linkKindLabels: Record<SiteLinkKind, string> = {
  development: "Development",
  staging: "Staging",
  live: "Live / Production",
  backend: "Backend / API",
  database: "Database",
  github: "GitHub",
  vercel: "Vercel",
  docs: "Documentation",
  other: "Other URL",
};

const defaultLinkRows: LinkDraft[] = [
  { kind: "live", label: "Live / production", url: "" },
  { kind: "development", label: "Development", url: "" },
  { kind: "github", label: "GitHub repository", url: "" },
  { kind: "vercel", label: "Vercel project", url: "" },
];

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    throw new Error(`${file.name}: choose an image smaller than 15 MB.`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}: this image could not be opened.`);
  }

  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare that image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.84, 0.74, 0.64, 0.54, 0.44]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= 650 * 1024) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the image."));
          reader.onerror = () => reject(new Error("Could not read the image."));
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error(`${file.name}: still too large after compression. Try a smaller image.`);
  } finally {
    bitmap.close();
  }
}

function initialLinks(editor: EditorState): LinkDraft[] {
  if (editor.mode === "edit" && editor.site.links.length > 0) {
    return editor.site.links.map(({ kind, label, url }) => ({
      kind: SITE_LINK_KINDS.includes(kind as SiteLinkKind) ? kind as SiteLinkKind : "other",
      label,
      url,
    }));
  }
  if (editor.mode === "edit") {
    return [{ ...defaultLinkRows[0], url: editor.site.url }, ...defaultLinkRows.slice(1)];
  }
  return defaultLinkRows.map((row) => ({ ...row }));
}

export default function SiteEditor({
  editor,
  onClose,
  onSave,
  onUploadImage,
  onRemoveImage,
  onNeedAuth,
}: {
  editor: EditorState;
  onClose: () => void;
  onSave: (siteId: number | null, values: SiteInput) => Promise<SiteDirectoryEntry>;
  onUploadImage: (siteId: number, upload: UploadResult) => Promise<SiteImageSummary>;
  onRemoveImage: (siteId: number, image: SiteImageSummary) => Promise<void>;
  onNeedAuth: () => void;
}) {
  const existingSite = editor.mode === "edit" ? editor.site : null;
  const [siteRecord, setSiteRecord] = useState<SiteDirectoryEntry | null>(existingSite);
  const [name, setName] = useState(existingSite?.name ?? "");
  const [description, setDescription] = useState(existingSite?.description ?? "");
  const [category, setCategory] = useState(existingSite?.category ?? "");
  const [owner, setOwner] = useState(existingSite?.owner ?? "");
  const [status, setStatus] = useState<SiteStatus>((existingSite?.status as SiteStatus) ?? "in-development");
  const [backendUrl, setBackendUrl] = useState(existingSite?.backendUrl ?? "");
  const [techStack, setTechStack] = useState(existingSite?.techStack ?? "");
  const [notes, setNotes] = useState(existingSite?.notes ?? "");
  const [links, setLinks] = useState<LinkDraft[]>(() => initialLinks(editor));
  const [images, setImages] = useState<SiteImageSummary[]>(existingSite?.images ?? []);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [imageAltText, setImageAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);

  function updateLink(index: number, patch: Partial<LinkDraft>) {
    setLinks((current) => current.map((link, linkIndex) => linkIndex === index ? { ...link, ...patch } : link));
  }

  function updateKind(index: number, kind: SiteLinkKind) {
    updateLink(index, { kind, label: links[index].label || linkKindLabels[kind] });
  }

  async function uploadSelectedImages(siteId: number, files: File[]) {
    for (const file of files) {
      const dataUrl = await optimizeImage(file);
      const added = await onUploadImage(siteId, {
        filename: file.name,
        altText: imageAltText.trim() || file.name.replace(/\\.[^.]+$/, ""),
        dataUrl,
      });
      setImages((current) => [...current, added]);
      setPendingImages((current) => current.filter((pending) => pending !== file));
    }
    setImageAltText("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const savedLinks = links
      .filter((link) => link.url.trim())
      .map((link) => ({ ...link, url: normalizeUrl(link.url) }));
    if (!savedLinks.length) {
      setError("Add at least one working URL. You can add live, development, GitHub, Vercel, or any other link.");
      setBusy(false);
      return;
    }

    const primary = savedLinks.find((link) => link.kind === "live")
      ?? savedLinks.find((link) => link.kind === "development")
      ?? savedLinks[0];
    const values: SiteInput = {
      name: name.trim(),
      url: primary.url,
      backendUrl: backendUrl.trim() ? normalizeUrl(backendUrl) : "",
      description: description.trim(),
      category: category.trim(),
      owner: owner.trim(),
      status,
      techStack: techStack.trim(),
      notes: notes.trim(),
      links: savedLinks,
    };

    try {
      const savedSite = await onSave(siteRecord?.id ?? null, values);
      setSiteRecord(savedSite);
      if (pendingImages.length > 0) {
        await uploadSelectedImages(savedSite.id, pendingImages);
        setNotice(`Project saved and ${pendingImages.length} selected image${pendingImages.length === 1 ? " was" : "s were"} uploaded.`);
      } else {
        setNotice("Project details saved. You can add multiple images from your device below.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this project.");
    } finally {
      setBusy(false);
    }
  }

  async function addImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    const remaining = 20 - images.length - pendingImages.length;
    if (files.length > remaining) {
      setError(`Select up to ${remaining} more image${remaining === 1 ? "" : "s"}. Each project can have 20 images.`);
      return;
    }

    setError("");
    setNotice("");
    setPendingImages((current) => [...current, ...files]);

    if (!siteRecord) {
      setNotice(`${files.length} image${files.length === 1 ? "" : "s"} queued. They will upload automatically when you save the project.`);
      return;
    }

    setUploadBusy(true);
    try {
      await uploadSelectedImages(siteRecord.id, files);
      setNotice(`${files.length} image${files.length === 1 ? "" : "s"} added to this project.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload the selected images. Your remaining files are still queued.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function retryQueuedImages() {
    if (!siteRecord || pendingImages.length === 0) return;
    setUploadBusy(true);
    setError("");
    try {
      const queued = [...pendingImages];
      await uploadSelectedImages(siteRecord.id, queued);
      setNotice(`${queued.length} image${queued.length === 1 ? "" : "s"} added to this project.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload the remaining images.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function removeImage(image: SiteImageSummary) {
    if (!siteRecord) return;
    setError("");
    try {
      await onRemoveImage(siteRecord.id, image);
      setImages((current) => current.filter((entry) => entry.id !== image.id));
      setNotice("Project image removed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this image.");
    }
  }

  const inputClass = "mt-1.5 min-h-10 w-full border border-[#385d39] bg-[#040a05] px-3 py-2 text-[11px] leading-5 text-[#c4ff9b] outline-none placeholder:text-[#5f7959] focus:border-[#78a965]";
  const labelClass = "block text-[9px] font-bold uppercase tracking-[0.1em] text-[#a2c493]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && !busy && !uploadBusy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="site-editor-title" className="modal-in my-auto max-h-[94vh] w-full max-w-[920px] overflow-y-auto border border-[#49744a] bg-[#0b150c] p-4 text-[#b7ff8a] shadow-2xl sm:p-6 lg:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[#29452c] pb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9bc28d]">DEVELOPER DIRECTORY · PROJECT RECORD</p>
            <h2 id="site-editor-title" className="mt-2 text-xl font-bold uppercase tracking-wide text-[#c1ff95]">{siteRecord ? "Edit project details" : "Add a project"}</h2>
            <p className="mt-1 text-[10px] leading-5 text-[#88a57e]">One reliable place for the live app, environments, repository, deployment, documentation, and handoff notes.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy || uploadBusy} aria-label="Close editor" className="grid h-9 w-9 shrink-0 place-items-center border border-[#344a34] bg-[#131a13] text-lg text-[#8ba27e]">×</button>
        </div>

        <form onSubmit={submit} className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Project / site name *
              <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Member Portal" className={inputClass} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Project status
                <select value={status} onChange={(event) => setStatus(event.target.value as SiteStatus)} className={inputClass}>
                  <option value="in-development">In development</option>
                  <option value="live">Live</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className={labelClass}>Category / team
                <input maxLength={100} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Web app, marketing, internal…" className={inputClass} />
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>What is this project?
              <textarea rows={2} maxLength={3000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description and who this site is for" className={inputClass} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Owner / contact
                <input maxLength={120} value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Team or maintainer" className={inputClass} />
              </label>
              <label className={labelClass}>Technology / stack
                <input maxLength={400} value={techStack} onChange={(event) => setTechStack(event.target.value)} placeholder="Next.js, Postgres, Vercel…" className={inputClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Backend / API base URL
                <input maxLength={2048} inputMode="url" autoCapitalize="none" autoCorrect="off" value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} placeholder="api.example.com or http://localhost:3001" className={inputClass} />
                <span className="mt-1 block text-[8px] font-normal normal-case tracking-normal text-[#71896b]">Shown on the project card and added to the links below as “Backend / API”.</span>
              </label>
            </div>
          </div>

          <section className="mt-6 border border-[#315537] bg-[#08110a] p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#baff91]">Environments & important links</h3>
                <p className="mt-1 text-[9px] leading-4 text-[#789373]">Add live and development URLs, GitHub, Vercel, staging, docs, and any project-specific URLs.</p>
              </div>
              <button type="button" disabled={links.length >= 25} onClick={() => setLinks((current) => [...current, { kind: "other", label: "Other URL", url: "" }])} className="min-h-8 border border-[#416b43] bg-[#102112] px-3 text-[9px] font-bold uppercase text-[#b8f19a] disabled:opacity-40">+ Add URL</button>
            </div>

            <div className="mt-4 space-y-2">
              {links.map((link, index) => (
                <div key={`project-link-${index}`} className="grid gap-2 border border-[#203d25] bg-[#071008] p-2 sm:grid-cols-[145px_minmax(120px,0.75fr)_minmax(160px,1.5fr)_32px] sm:items-center">
                  <label className="sr-only" htmlFor={`project-kind-${index}`}>URL type</label>
                  <select id={`project-kind-${index}`} value={link.kind} onChange={(event) => updateKind(index, event.target.value as SiteLinkKind)} className="min-h-9 border border-[#315537] bg-[#09140b] px-2 text-[10px] text-[#b9f797] outline-none focus:border-[#78a965]">
                    {SITE_LINK_KINDS.map((kind) => <option key={kind} value={kind}>{linkKindLabels[kind]}</option>)}
                  </select>
                  <label className="sr-only" htmlFor={`project-label-${index}`}>Link label</label>
                  <input id={`project-label-${index}`} maxLength={100} value={link.label} onChange={(event) => updateLink(index, { label: event.target.value })} placeholder="Link label" className="min-h-9 min-w-0 border border-[#315537] bg-[#09140b] px-2.5 text-[10px] text-[#b9f797] outline-none placeholder:text-[#607a5a] focus:border-[#78a965]" />
                  <label className="sr-only" htmlFor={`project-url-${index}`}>URL</label>
                  <input id={`project-url-${index}`} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" value={link.url} onChange={(event) => updateLink(index, { url: event.target.value })} placeholder={link.kind === "github" ? "github.com/org/repository" : link.kind === "vercel" ? "vercel.com/team/project" : link.kind === "development" ? "http://localhost:3000 or preview URL" : "https://…"} className="min-h-9 min-w-0 border border-[#315537] bg-[#09140b] px-2.5 text-[10px] text-[#b9f797] outline-none placeholder:text-[#607a5a] focus:border-[#78a965]" />
                  <button type="button" disabled={links.length <= 1} onClick={() => setLinks((current) => current.filter((_, linkIndex) => linkIndex !== index))} aria-label={`Remove ${link.label || "link"}`} className="grid h-8 w-8 place-items-center border border-[#5d3c35] bg-[#21120f] text-sm text-[#e7a995] disabled:opacity-30">×</button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-[#71896b]">At least one URL is required. Empty optional rows are ignored. For a local development server, use <code>http://localhost:3000</code>.</p>
          </section>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Developer handoff / setup notes
              <textarea rows={4} maxLength={6000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="How to run locally, environment variables required (never paste secret values), test account instructions, deployment details, known issues…" className={inputClass} />
            </label>
            <section className="border border-[#315537] bg-[#08110a] p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#baff91]">Project images</h3>
                  <p className="mt-1 text-[9px] leading-4 text-[#789373]">Select multiple screenshots, diagrams, or mockups from your device. {images.length + pendingImages.length}/20 selected.</p>
                </div>
                {images.length + pendingImages.length < 20 && (
                  <>
                    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={addImages} disabled={uploadBusy} className="sr-only" aria-label="Choose multiple project images from your device" />
                    <button type="button" onClick={() => imageInput.current?.click()} disabled={uploadBusy} className="min-h-8 shrink-0 border border-[#6ba259] bg-[#17361b] px-3 text-[9px] font-bold uppercase text-[#d6ffc0] disabled:opacity-50">{uploadBusy ? "Uploading…" : "+ Upload multiple"}</button>
                  </>
                )}
              </div>
              <label className="mt-3 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[#88a57e]">Description for the next upload(s)
                <input maxLength={180} value={imageAltText} onChange={(event) => setImageAltText(event.target.value)} placeholder="e.g. Current live homepage screenshot" className="mt-1.5 min-h-9 w-full border border-[#315537] bg-[#071008] px-2.5 text-[10px] text-[#b9f797] outline-none placeholder:text-[#607a5a] focus:border-[#78a965]" />
              </label>
              {!siteRecord && <p className="mt-3 border border-dashed border-[#315537] p-3 text-[9px] leading-4 text-[#86a17b]">Choose one or more files now. They will be queued here and uploaded automatically when you create this project.</p>}
              {siteRecord && pendingImages.length > 0 && (
                <div className="mt-3 border border-[#416b43] bg-[#0a170b] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="m-0 text-[9px] font-semibold text-[#b4e899]">{pendingImages.length} image{pendingImages.length === 1 ? "" : "s"} waiting to upload</p>
                    <button type="button" disabled={uploadBusy} onClick={() => void retryQueuedImages()} className="border border-[#6ba259] bg-[#17361b] px-2 py-1 text-[8px] font-bold uppercase text-[#d6ffc0]">{uploadBusy ? "Uploading…" : "Upload queued"}</button>
                  </div>
                </div>
              )}
              {pendingImages.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pendingImages.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-2 border border-[#263e28] bg-[#071008] px-2 py-1.5 text-[8px] text-[#9abd8c]">
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button type="button" disabled={uploadBusy} onClick={() => setPendingImages((current) => current.filter((pending) => pending !== file))} className="shrink-0 px-1 text-[#d99e8c]" aria-label={`Remove queued image ${file.name}`}>×</button>
                    </li>
                  ))}
                </ul>
              )}
              {images.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {images.map((image) => (
                    <figure key={image.id} className="group relative m-0 overflow-hidden border border-[#29452c] bg-[#050905]">
                      <img src={`/api/sites/${image.siteId}/images/${image.id}`} alt={image.altText || image.filename} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      <figcaption className="flex min-h-7 items-center justify-between gap-1 px-1.5 py-1 text-[8px] text-[#8aa57e]">
                        <span className="truncate">{image.altText || image.filename}</span>
                        <button type="button" disabled={uploadBusy} onClick={() => void removeImage(image)} className="shrink-0 border border-[#5d3c35] bg-[#21120f] px-1.5 py-0.5 text-[8px] uppercase text-[#e7a995]">×</button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : pendingImages.length === 0 && siteRecord && (
                <div className="mt-3 border border-dashed border-[#315537] p-4 text-center text-[9px] text-[#71896b]">No project images yet. The upload button accepts multiple files at once.</div>
              )}
            </section>
          </div>

          {error && <p role="alert" className="mt-4 border border-[#76433a] bg-[#28140f] p-3 text-[10px] leading-5 text-[#ffc0a8]">{error}{error.toLowerCase().includes("unlock admin") && <button type="button" onClick={onNeedAuth} className="ml-2 underline">Sign in</button>}</p>}
          {notice && <p role="status" className="mt-4 border border-[#345b37] bg-[#0e2010] p-3 text-[10px] leading-5 text-[#b3ed97]">{notice}</p>}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#29452c] pt-4">
            <p className="m-0 text-[9px] text-[#71896b]">{siteRecord ? `PROJECT ID: ${siteRecord.id}` : "You can queue images before creating this project."}</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={busy || uploadBusy} className="min-h-10 border border-[#3c5d3d] bg-[#101b11] px-4 text-[9px] font-semibold uppercase text-[#a7dc8b]">Done</button>
              <button type="submit" disabled={busy || uploadBusy || !name.trim()} className="min-h-10 border border-[#6ba259] bg-[#17361b] px-5 text-[9px] font-bold uppercase text-[#d6ffc0] disabled:opacity-50">{busy ? "Saving project…" : siteRecord ? "Save project details" : "Create project"}</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
