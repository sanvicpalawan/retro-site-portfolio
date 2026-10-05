"use client";

import { BookOpen, Globe, Mail, MapPin, Phone } from "lucide-react";
import type { FooterLinkRecord } from "@/db/schema";
import type { SiteContent } from "@/lib/site-content";
import type { FooterPlatform } from "@/lib/footer-links";
import {
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  VercelIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/brand-icons";

type FooterIcon = (props: { className?: string }) => React.ReactElement;

const platformIcons: Record<FooterPlatform, FooterIcon> = {
  github: GithubIcon,
  vercel: VercelIcon,
  instagram: InstagramIcon,
  x: XIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  email: (props) => <Mail {...props} />,
  docs: (props) => <BookOpen {...props} />,
  link: (props) => <Globe {...props} />,
};

function iconFor(platform: string) {
  return platformIcons[platform as FooterPlatform] ?? Globe;
}

export default function SiteFooter({
  content,
  links,
  isAdmin,
  onManage,
}: {
  content: SiteContent;
  links: FooterLinkRecord[];
  isAdmin: boolean;
  onManage: () => void;
}) {
  const socialLinks = links.filter((link) => link.group === "social");
  const resourceLinks = links.filter((link) => link.group === "resource");
  const legalLinks = links.filter((link) => link.group === "legal");
  const year = new Date().getFullYear();

  return (
    <footer id="about" className="site-footer mt-10 scroll-mt-28 border-t border-[#2a4a2e] pt-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7ca072]">{content.footerOrganization}</p>
          <p className="mt-2.5 max-w-[42ch] text-[11px] leading-[1.75] text-[#8fae84]">{content.footerTagline}</p>

          {socialLinks.length > 0 && (
            <ul className="mt-5 flex list-none flex-wrap gap-2 p-0">
              {socialLinks.map((link) => {
                const Icon = iconFor(link.platform);
                return (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target={link.platform === "email" ? undefined : "_blank"}
                      rel="noreferrer"
                      aria-label={link.label}
                      title={link.label}
                      className="footer-social grid h-10 w-10 place-items-center rounded-[3px] border border-[#345c39] text-[#a9e58f] transition"
                    >
                      <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          <h2 className="m-0 text-[10px] font-bold uppercase tracking-[0.17em] text-[#7ca072]">Contact</h2>
          <ul className="mt-3 list-none space-y-2 p-0 text-[10px] text-[#8fae84]">
            {content.footerEmail && (
              <li>
                <a href={`mailto:${content.footerEmail}`} className="footer-text-link inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-all">{content.footerEmail}</span>
                </a>
              </li>
            )}
            {content.footerPhone && (
              <li>
                <a href={`tel:${content.footerPhone.replace(/[^\d+]/g, "")}`} className="footer-text-link inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{content.footerPhone}</span>
                </a>
              </li>
            )}
            {content.footerLocation && (
              <li className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{content.footerLocation}</span>
              </li>
            )}
            {!content.footerEmail && !content.footerPhone && !content.footerLocation && (
              <li className="text-[#6f8a68]">Add contact details in admin.</li>
            )}
          </ul>
        </div>

        <div className="min-w-0">
          <h2 className="m-0 text-[10px] font-bold uppercase tracking-[0.17em] text-[#7ca072]">Resources</h2>
          {resourceLinks.length > 0 ? (
            <ul className="mt-3 list-none space-y-2 p-0 text-[10px]">
              {resourceLinks.map((link) => {
                const Icon = iconFor(link.platform);
                return (
                  <li key={link.id}>
                    <a href={link.url} target="_blank" rel="noreferrer" className="footer-text-link inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{link.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[10px] text-[#6f8a68]">Add documentation, status pages, or handbooks in admin.</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-[#243f28] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-[9px] uppercase tracking-[0.1em] text-[#71896b]">
          © {year} {content.footerOrganization}. {content.footerLegal}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {legalLinks.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="footer-text-link text-[9px] uppercase tracking-[0.08em]">
              {link.label}
            </a>
          ))}
          {isAdmin && (
            <button type="button" onClick={onManage} className="footer-manage border border-[#416b43] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.06em]">
              Edit footer
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
