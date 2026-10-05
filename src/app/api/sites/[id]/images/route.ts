import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteImages, sites } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";
import { MAX_SITE_IMAGES, parseSiteImageUpload } from "@/lib/media-validation";

type RouteContext = { params: Promise<{ id: string }> };

async function getSiteId(context: RouteContext) {
  const { id } = await context.params;
  const parsedId = Number(id);
  return Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const siteId = await getSiteId(context);
  if (!siteId) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const images = await db.select({
    id: siteImages.id,
    siteId: siteImages.siteId,
    filename: siteImages.filename,
    mimeType: siteImages.mimeType,
    altText: siteImages.altText,
    createdAt: siteImages.createdAt,
  }).from(siteImages).where(eq(siteImages.siteId, siteId)).orderBy(desc(siteImages.createdAt));
  return NextResponse.json(images);
}

export async function POST(request: Request, context: RouteContext) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const siteId = await getSiteId(context);
  if (!siteId) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The image could not be read. Please try again." }, { status: 400 });
  }

  const upload = parseSiteImageUpload(body, siteId);
  if (!upload) {
    return NextResponse.json({ error: "Choose a PNG, JPEG, or WebP image. Each image must be under 700 KB after compression." }, { status: 400 });
  }

  const [project] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const [imageCount] = await db.select({ value: count() }).from(siteImages).where(eq(siteImages.siteId, siteId));
  if (imageCount.value >= MAX_SITE_IMAGES) {
    return NextResponse.json({ error: `A project can have up to ${MAX_SITE_IMAGES} images.` }, { status: 409 });
  }

  const [saved] = await db.insert(siteImages).values(upload).returning({
    id: siteImages.id,
    siteId: siteImages.siteId,
    filename: siteImages.filename,
    mimeType: siteImages.mimeType,
    altText: siteImages.altText,
    createdAt: siteImages.createdAt,
  });
  return NextResponse.json(saved, { status: 201 });
}
