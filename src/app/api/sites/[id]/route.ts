import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteImages, siteLinks, sites } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";
import { parseSiteInput } from "@/lib/site-validation";

type RouteContext = { params: Promise<{ id: string }> };

async function getSiteId(context: RouteContext) {
  const { id } = await context.params;
  const parsedId = Number(id);
  return Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const id = await getSiteId(context);
  if (!id) return NextResponse.json({ error: "Project not found." }, { status: 404 });

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
  const updated = await db.transaction(async (tx) => {
    const [site] = await tx.update(sites).set(siteValues).where(eq(sites.id, id)).returning();
    if (!site) return null;

    await tx.delete(siteLinks).where(eq(siteLinks.siteId, id));
    const savedLinks = await tx.insert(siteLinks).values(links.map((link) => ({ ...link, siteId: id }))).returning();
    const savedImages = await tx.select({
      id: siteImages.id,
      siteId: siteImages.siteId,
      filename: siteImages.filename,
      mimeType: siteImages.mimeType,
      altText: siteImages.altText,
      createdAt: siteImages.createdAt,
    }).from(siteImages).where(eq(siteImages.siteId, id)).orderBy(asc(siteImages.id));
    return { ...site, links: savedLinks, images: savedImages };
  });

  if (!updated) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const id = await getSiteId(context);
  if (!id) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const [removed] = await db.delete(sites).where(eq(sites.id, id)).returning({ id: sites.id });
  if (!removed) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ deleted: true, id: removed.id });
}
