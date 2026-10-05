import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteImages } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

async function getIds(context: RouteContext) {
  const { id, imageId } = await context.params;
  const siteId = Number(id);
  const parsedImageId = Number(imageId);
  if (!Number.isSafeInteger(siteId) || siteId < 1 || !Number.isSafeInteger(parsedImageId) || parsedImageId < 1) return null;
  return { siteId, imageId: parsedImageId };
}

export async function GET(_request: Request, context: RouteContext) {
  const ids = await getIds(context);
  if (!ids) return new NextResponse("Not found", { status: 404 });

  const [image] = await db.select({
    data: siteImages.data,
    mimeType: siteImages.mimeType,
  }).from(siteImages).where(and(eq(siteImages.id, ids.imageId), eq(siteImages.siteId, ids.siteId))).limit(1);

  if (!image) return new NextResponse("Not found", { status: 404 });

  return new Response(new Uint8Array(Buffer.from(image.data, "base64")), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const ids = await getIds(context);
  if (!ids) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const [removed] = await db.delete(siteImages).where(
    and(eq(siteImages.id, ids.imageId), eq(siteImages.siteId, ids.siteId)),
  ).returning({ id: siteImages.id });

  if (!removed) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  return NextResponse.json({ deleted: true, id: removed.id });
}
