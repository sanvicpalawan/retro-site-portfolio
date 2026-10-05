"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { FooterLinkRecord } from "@/db/schema";
import {
  FOOTER_GROUPS,
  FOOTER_PLATFORMS,
  FOOTER_PLATFORM_LABELS,
  MAX_FOOTER_LINKS,
  type FooterGroup,
  type FooterLinkInput,
  type FooterPlatform,
} from "@/lib/footer-links";
import type { SiteContent } from "@/lib/site-content";

type DraftLink = {
  platform: FooterPlatform;
  label: string;
  url: string;
  group: FooterGroup;
  sortOrder: number;
};

const groupLabels: Record<FooterGroup, string> = {
  social: "Social icon",
  resource: "Resource link",
  legal: "Legal / bottom bar",
};

const emptyDraft: DraftLink = { platform: "github", label: "GitHub", url: "", group: "social", sortOrder: 0 };

export default function FooterEditor({
  content,
  links,
  onClose,
  onSaveDetails,
  onCreateLink,
  onUpdateLink,
  onDeleteLink,
}: {
  content: SiteContent;
  links: FooterLinkRecord[];
  onClose: () => void;
  onSaveDetails: (content: SiteContent) => Promise<void>;
  onCreateLink: (input: FooterLinkInput) => Promise<FooterLinkRecord>;
  onUpdateLink: (id: number, input: FooterLinkInput) => Promise<FooterLinkRecord>;
  onDeleteLink: (link: FooterLinkRecord) => Promise<void>;
}) {
  const [details, setDetails] = useState(content);
  const [draft, setDraft] = useState<DraftLink>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function setField(key: keyof SiteContent, value: string) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await onSaveDetails(details);
      setNotice("Footer details saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the footer details.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkBusy(true);
    setError("");
    setNotice("");
    try {
      const input: FooterLinkInput = {
        platform: draft.platform,
        label: draft.label.trim() || FOOTER_PLATFORM_LABELS[draft.platform],
        url: draft.url.trim(),
        group: draft.group,
        sortOrder: draft.sortOrder,
      };
      if (editingId === null) {
        await onCreateLink(input);
        setNotice("Footer link added.");
      } else {
        await onUpdateLink(editingId, input);
        setNotice("Footer link updated.");
      }
      setDraft(emptyDraft);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this footer link.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function removeLink(link: FooterLinkRecord) {
    setError("");
    setNotice("");
    try {
      await onDeleteLink(link);
      if (editingId === link.id) {
        setEditingId(null);
        setDraft(emptyDraft);
      }
      setNotice("Footer link deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this footer link.");
    }
  }

  function startEditing(link: FooterLinkRecord) {
    setEditingId(link.id);
    setDraft({
      platform: (FOOTER_PLATFORMS.includes(link.platform as FooterPlatform) ? link.platform : "link") as FooterPlatform,
      label: link.label,
      url: link.platform === "email" ? link.url.replace(/^mailto:/i, "") : link.url,
      group: (FOOTER_GROUPS.includes(link.group as FooterGroup) ? link.group : "social") as FooterGroup,
      sortOrder: link.sortOrder,
    });
    setNotice("");
    setError("");
  }

  const inputClass = "mt-1.5 min-h-10 w-full border border-[#385d39] bg-[#040a05] px-3 py-2 text-[11px] leading-5 text-[#c4ff9b] outline-none placeholder:text-[#5f7959] focus:border-[#78a965]";
  const labelClass = "block text-[9px] font-bold uppercase tracking-[0.1em] text-[#a2c493]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && !busy && !linkBusy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="footer-editor-title" className="modal-in my-auto max-h-[94vh] w-full max-w-[860px] overflow-y-auto border border-[#49744a] bg-[#0b150c] p-4 text-[#b7ff8a] shadow-2xl sm:p-6 lg:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[#29452c] pb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#9bc28d]">ADMIN · FOOTER</p>
            <h2 id="footer-editor-title" className="mt-2 text-xl font-bold uppercase tracking-wide text-[#c1ff95]">Footer settings</h2>
            <p className="mt-1 text-[10px] leading-5 text-[#88a57e]">Edit the organization details, contact information, social icons, and resource links shown to everyone.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy || linkBusy} aria-label="Close footer editor" className="grid h-9 w-9 shrink-0 place-items-center border border-[#344a34] bg-[#131a13] text-lg text-[#8ba27e]">×</button>
        </div>

        <form onSubmit={saveDetails} className="mt-5 border border-[#315537] bg-[#08110a] p-3 sm:p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#baff91]">Organization & contact</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Organization name
              <input maxLength={120} value={details.footerOrganization} onChange={(event) => setField("footerOrganization", event.target.value)} placeholder="Palawan Collective" className={inputClass} />
            </label>
            <label className={labelClass}>Location
              <input maxLength={180} value={details.footerLocation} onChange={(event) => setField("footerLocation", event.target.value)} placeholder="Manila × Texas" className={inputClass} />
            </label>
          </div>
          <label className={`${labelClass} mt-3`}>Footer tagline
            <textarea rows={2} maxLength={300} value={details.footerTagline} onChange={(event) => setField("footerTagline", event.target.value)} placeholder="What this directory is for" className={inputClass} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Contact email
              <input type="email" maxLength={180} value={details.footerEmail} onChange={(event) => setField("footerEmail", event.target.value)} placeholder="team@example.com" className={inputClass} />
            </label>
            <label className={labelClass}>Contact phone
              <input maxLength={60} value={details.footerPhone} onChange={(event) => setField("footerPhone", event.target.value)} placeholder="+1 555 000 1234" className={inputClass} />
            </label>
          </div>
          <label className={`${labelClass} mt-3`}>Legal line (shown after the copyright year)
            <input maxLength={200} value={details.footerLegal} onChange={(event) => setField("footerLegal", event.target.value)} placeholder="All rights reserved." className={inputClass} />
          </label>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={busy} className="min-h-10 border border-[#6ba259] bg-[#17361b] px-5 text-[9px] font-bold uppercase text-[#d6ffc0] disabled:opacity-50">{busy ? "Saving…" : "Save footer details"}</button>
          </div>
        </form>

        <section className="mt-5 border border-[#315537] bg-[#08110a] p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#baff91]">Footer links & social icons</h3>
            <span className="text-[9px] text-[#789373]">{links.length}/{MAX_FOOTER_LINKS} saved</span>
          </div>

          <form onSubmit={submitLink} className="mt-3 grid gap-2 border border-[#203d25] bg-[#071008] p-2.5 sm:grid-cols-[130px_minmax(110px,1fr)_minmax(150px,1.4fr)_120px_70px_auto] sm:items-end">
            <label className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#88a57e]">Platform
              <select value={draft.platform} onChange={(event) => {
                const platform = event.target.value as FooterPlatform;
                setDraft((current) => ({ ...current, platform, label: current.label || FOOTER_PLATFORM_LABELS[platform] }));
              }} className="mt-1 min-h-9 w-full border border-[#315537] bg-[#09140b] px-2 text-[10px] text-[#b9f797] outline-none focus:border-[#78a965]">
                {FOOTER_PLATFORMS.map((platform) => <option key={platform} value={platform}>{FOOTER_PLATFORM_LABELS[platform]}</option>)}
              </select>
            </label>
            <label className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#88a57e]">Label
              <input maxLength={80} value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} placeholder="GitHub" className="mt-1 min-h-9 w-full min-w-0 border border-[#315537] bg-[#09140b] px-2.5 text-[10px] text-[#b9f797] outline-none placeholder:text-[#607a5a] focus:border-[#78a965]" />
            </label>
            <label className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#88a57e]">{draft.platform === "email" ? "Email address" : "URL"}
              <input required maxLength={2048} inputMode="url" autoCapitalize="none" autoCorrect="off" value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} placeholder={draft.platform === "email" ? "team@example.com" : draft.platform === "x" ? "x.com/yourhandle" : "github.com/your-org"} className="mt-1 min-h-9 w-full min-w-0 border border-[#315537] bg-[#09140b] px-2.5 text-[10px] text-[#b9f797] outline-none placeholder:text-[#607a5a] focus:border-[#78a965]" />
            </label>
            <label className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#88a57e]">Placement
              <select value={draft.group} onChange={(event) => setDraft((current) => ({ ...current, group: event.target.value as FooterGroup }))} className="mt-1 min-h-9 w-full border border-[#315537] bg-[#09140b] px-2 text-[10px] text-[#b9f797] outline-none focus:border-[#78a965]">
                {FOOTER_GROUPS.map((group) => <option key={group} value={group}>{groupLabels[group]}</option>)}
              </select>
            </label>
            <label className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#88a57e]">Order
              <input type="number" min={0} max={999} value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} className="mt-1 min-h-9 w-full border border-[#315537] bg-[#09140b] px-2 text-[10px] text-[#b9f797] outline-none focus:border-[#78a965]" />
            </label>
            <div className="flex gap-1.5">
              <button type="submit" disabled={linkBusy} className="min-h-9 border border-[#6ba259] bg-[#17361b] px-3 text-[9px] font-bold uppercase text-[#d6ffc0] disabled:opacity-50">{linkBusy ? "Saving…" : editingId === null ? "Add" : "Update"}</button>
              {editingId !== null && (
                <button type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft); }} className="min-h-9 border border-[#3c5d3d] bg-[#101b11] px-2.5 text-[9px] font-semibold uppercase text-[#a7dc8b]">Cancel</button>
              )}
            </div>
          </form>

          {links.length > 0 ? (
            <ul className="mt-3 list-none space-y-1.5 p-0">
              {links.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 border border-[#263e28] bg-[#071008] px-2.5 py-2 text-[9px] text-[#9abd8c]">
                  <span className="min-w-0">
                    <span className="font-bold uppercase text-[#b9f797]">{link.label}</span>
                    <span className="mx-1.5 text-[#4f6a4c]">·</span>
                    <span className="uppercase">{groupLabels[(FOOTER_GROUPS.includes(link.group as FooterGroup) ? link.group : "social") as FooterGroup]}</span>
                    <span className="mx-1.5 text-[#4f6a4c]">·</span>
                    <span className="break-all text-[#789373]">{link.url}</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => startEditing(link)} className="border border-[#3c5d3d] bg-[#101b11] px-2 py-1 text-[8px] font-semibold uppercase text-[#a7dc8b]">Edit</button>
                    <button type="button" onClick={() => void removeLink(link)} className="border border-[#5d3c35] bg-[#21120f] px-2 py-1 text-[8px] font-semibold uppercase text-[#e7a995]">Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border border-dashed border-[#315537] p-3 text-center text-[9px] text-[#789373]">No footer links yet. Add GitHub, Vercel, Instagram, or X to show social icons.</p>
          )}
        </section>

        {error && <p role="alert" className="mt-4 border border-[#76433a] bg-[#28140f] p-3 text-[10px] leading-5 text-[#ffc0a8]">{error}</p>}
        {notice && <p role="status" className="mt-4 border border-[#345b37] bg-[#0e2010] p-3 text-[10px] leading-5 text-[#b3ed97]">{notice}</p>}

        <div className="mt-5 flex justify-end border-t border-[#29452c] pt-4">
          <button type="button" onClick={onClose} disabled={busy || linkBusy} className="min-h-10 border border-[#3c5d3d] bg-[#101b11] px-4 text-[9px] font-semibold uppercase text-[#a7dc8b]">Done</button>
        </div>
      </section>
    </div>
  );
}
