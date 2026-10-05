import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteMedia } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> };

async function getMediaId(context: RouteContext) {
  const { id } = await context.params;
  const parsedId = Number(id);
  return Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await getMediaId(context);
  if (!id) return new NextResponse("Not found", { status: 404 });

  const [media] = await db.select({ data: siteMedia.data, mimeType: siteMedia.mimeType })
    .from(siteMedia).where(eq(siteMedia.id, id)).limit(1);
  if (!media) return new NextResponse("Not found", { status: 404 });

  const image = new Uint8Array(Buffer.from(media.data, "base64"));
  return new Response(image, {
    headers: {
      "Content-Type": media.mimeType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required. Please unlock admin and try again." }, { status: 401 });
  }

  const id = await getMediaId(context);
  if (!id) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const [removed] = await db.delete(siteMedia).where(eq(siteMedia.id, id)).returning({ id: siteMedia.id });
  if (!removed) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  return NextResponse.json({ deleted: true, id: removed.id });
}
