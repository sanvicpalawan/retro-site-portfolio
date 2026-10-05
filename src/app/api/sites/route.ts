import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteImages, siteLinks, sites } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";
import { parseSiteInput } from "@/lib/site-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const [allSites, allLinks, allImages] = await Promise.all([
    db.select().from(sites).orderBy(asc(sites.name)),
    db.select().from(siteLinks).orderBy(asc(siteLinks.id)),
    db.select({
      id: siteImages.id,
      siteId: siteImages.siteId,
      filename: siteImages.filename,
      mimeType: siteImages.mimeType,
      altText: siteImages.altText,
      createdAt: siteImages.createdAt,
    }).from(siteImages),
  ]);

  return NextResponse.json(allSites.map((site) => ({
    ...site,
    links: allLinks.filter((link) => link.siteId === site.id),
    images: allImages.filter((image) => image.siteId === site.id),
  })));
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the project details and links." }, { status: 400 });
  }

  const input = parseSiteInput(body);
  if (!input) {
    return NextResponse.json({ error: "Enter a project name and at least one valid http or https link." }, { status: 400 });
  }

  const { links, ...siteValues } = input;
  const created = await db.transaction(async (tx) => {
    const [site] = await tx.insert(sites).values(siteValues).returning();
    const savedLinks = await tx.insert(siteLinks).values(links.map((link) => ({ ...link, siteId: site.id }))).returning();
    return { ...site, links: savedLinks, images: [] };
  });

  return NextResponse.json(created, { status: 201 });
}
