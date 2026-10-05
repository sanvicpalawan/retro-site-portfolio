import { asc, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { footerLinks } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin-auth";
import { MAX_FOOTER_LINKS, parseFooterLinkInput } from "@/lib/footer-links";

export const dynamic = "force-dynamic";

export async function GET() {
  const links = await db.select().from(footerLinks)
    .orderBy(asc(footerLinks.sortOrder), asc(footerLinks.id));
  return NextResponse.json(links);
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 401 });
  }

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

  const [existing] = await db.select({ value: count() }).from(footerLinks);
  if (existing.value >= MAX_FOOTER_LINKS) {
    return NextResponse.json({ error: `The footer holds up to ${MAX_FOOTER_LINKS} links.` }, { status: 409 });
  }

  const [created] = await db.insert(footerLinks).values(input).returning();
  return NextResponse.json(created, { status: 201 });
}
