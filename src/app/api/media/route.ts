import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteMedia } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";
import { MAX_MEDIA_ITEMS, parseMediaUpload } from "@/lib/media-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await db.select({
    id: siteMedia.id,
    filename: siteMedia.filename,
    mimeType: siteMedia.mimeType,
    altText: siteMedia.altText,
    createdAt: siteMedia.createdAt,
  }).from(siteMedia).orderBy(desc(siteMedia.createdAt));
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required. Please unlock admin and try again." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The image upload could not be read. Please try again." }, { status: 400 });
  }

  const upload = parseMediaUpload(body);
  if (!upload) {
    return NextResponse.json({ error: "Choose a compressed PNG, JPEG, or WebP image under 1 MB." }, { status: 400 });
  }

  const [currentCount] = await db.select({ value: count() }).from(siteMedia);
  if (currentCount.value >= MAX_MEDIA_ITEMS) {
    return NextResponse.json({ error: `This gallery holds up to ${MAX_MEDIA_ITEMS} images. Remove one to add another.` }, { status: 409 });
  }

  const [saved] = await db.insert(siteMedia).values(upload).returning({
    id: siteMedia.id,
    filename: siteMedia.filename,
    mimeType: siteMedia.mimeType,
    altText: siteMedia.altText,
    createdAt: siteMedia.createdAt,
  });
  return NextResponse.json(saved, { status: 201 });
}
