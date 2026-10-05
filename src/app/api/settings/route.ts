import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings, type SiteSettingsRecord } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";
import { DEFAULT_SITE_CONTENT, parseSiteContent, type SiteContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export function toSiteContent(saved: SiteSettingsRecord | undefined): SiteContent {
  if (!saved) return DEFAULT_SITE_CONTENT;
  return {
    logoData: saved.logoData,
    badgeText: saved.badgeText,
    heroHeading: saved.heroHeading,
    heroHighlight: saved.heroHighlight,
    heroDescription: saved.heroDescription,
    collectionHeading: saved.collectionHeading,
    collectionDescription: saved.collectionDescription,
    aboutText: saved.aboutText,
    footerOrganization: saved.footerOrganization,
    footerTagline: saved.footerTagline,
    footerEmail: saved.footerEmail,
    footerPhone: saved.footerPhone,
    footerLocation: saved.footerLocation,
    footerLegal: saved.footerLegal,
  };
}

export async function GET() {
  const [saved] = await db.select().from(siteSettings).limit(1);
  return NextResponse.json(toSiteContent(saved));
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required. Please unlock admin and try again." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the text and logo, then try again." }, { status: 400 });
  }

  const content = parseSiteContent(body);
  if (!content) {
    return NextResponse.json(
      { error: "Check the footer email address and field lengths, or choose a supported logo image." },
      { status: 400 },
    );
  }

  const [saved] = await db.insert(siteSettings).values({ id: 1, ...content, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { ...content, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json(toSiteContent(saved));
}
