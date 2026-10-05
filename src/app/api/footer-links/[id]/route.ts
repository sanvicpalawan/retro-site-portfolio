import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { footerLinks } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";
import { parseFooterLinkInput } from "@/lib/footer-links";

type RouteContext = { params: Promise<{ id: string }> };

async function getLinkId(context: RouteContext) {
  const { id } = await context.params;
  const parsedId = Number(id);
  return Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const id = await getLinkId(context);
  if (!id) return NextResponse.json({ error: "Footer link not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the footer link details." }, { status: 400 });
  }

  const input = parseFooterLinkInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Choose a platform, add a label, and enter a valid URL or email address." },
      { status: 400 },
    );
  }

  const [updated] = await db.update(footerLinks).set(input).where(eq(footerLinks.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Footer link not found." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

  const id = await getLinkId(context);
  if (!id) return NextResponse.json({ error: "Footer link not found." }, { status: 404 });

  const [removed] = await db.delete(footerLinks).where(eq(footerLinks.id, id)).returning({ id: footerLinks.id });
  if (!removed) return NextResponse.json({ error: "Footer link not found." }, { status: 404 });
  return NextResponse.json({ deleted: true, id: removed.id });
}
