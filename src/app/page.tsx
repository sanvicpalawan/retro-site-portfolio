import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { footerLinks, siteImages, siteLinks, siteMedia, siteSettings, sites } from "@/db/schema";
import CollectiveDashboard from "@/components/collective-dashboard";
import { toSiteContent } from "@/app/api/settings/route";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [savedSites, savedLinks, savedSiteImages, savedSettings, savedMedia, savedFooterLinks] = await Promise.all([
    db.select().from(sites).orderBy(asc(sites.name)),
    db.select().from(siteLinks).orderBy(asc(siteLinks.id)),
    db.select({
      id: siteImages.id,
      siteId: siteImages.siteId,
      filename: siteImages.filename,
      mimeType: siteImages.mimeType,
      altText: siteImages.altText,
      createdAt: siteImages.createdAt,
    }).from(siteImages).orderBy(desc(siteImages.createdAt)),
    db.select().from(siteSettings).limit(1),
    db.select({
      id: siteMedia.id,
      filename: siteMedia.filename,
      mimeType: siteMedia.mimeType,
      altText: siteMedia.altText,
      createdAt: siteMedia.createdAt,
    }).from(siteMedia).orderBy(desc(siteMedia.createdAt)),
    db.select().from(footerLinks).orderBy(asc(footerLinks.sortOrder), asc(footerLinks.id)),
  ]);

  const content = toSiteContent(savedSettings[0]);

  const sitesWithDetails = savedSites.map((site) => {
    const links = savedLinks.filter((link) => link.siteId === site.id);
    return {
      ...site,
      links: links.length ? links : [{
        id: 0,
        siteId: site.id,
        kind: "live",
        label: "Primary site",
        url: site.url,
        createdAt: site.createdAt,
      }],
      images: savedSiteImages.filter((image) => image.siteId === site.id),
    };
  });

  return (
    <CollectiveDashboard
      initialSites={sitesWithDetails}
      initialContent={content}
      initialMedia={savedMedia}
      initialFooterLinks={savedFooterLinks}
    />
  );
}
