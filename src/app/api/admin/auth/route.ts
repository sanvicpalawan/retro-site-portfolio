import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  createAdminToken,
  getAdminSessionToken,
  revokeAdminSession,
  storeAdminSession,
} from "@/lib/admin-auth";

function setSessionCookie(response: NextResponse, sessionToken: string) {
  response.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export async function GET(request: Request) {
  const sessionToken = await getAdminSessionToken(request);
  const response = NextResponse.json({ authenticated: Boolean(sessionToken), sessionToken: sessionToken ?? null });
  if (sessionToken) setSessionCookie(response, sessionToken);
  return response;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter the admin passkey." }, { status: 400 });
  }

  const candidate =
    body && typeof body === "object" && "passkey" in body && typeof body.passkey === "string"
      ? body.passkey
      : "";
  const expected = process.env.ADMIN_PASSKEY ?? "5309";
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  const accepted =
    candidateBytes.length === expectedBytes.length &&
    candidateBytes.length > 0 &&
    (await import("node:crypto")).timingSafeEqual(candidateBytes, expectedBytes);

  if (!accepted) {
    return NextResponse.json({ error: "That passkey wasn’t correct. Try again." }, { status: 401 });
  }

  const sessionToken = createAdminToken();
  await storeAdminSession(sessionToken);
  const response = NextResponse.json({ authenticated: true, sessionToken });
  setSessionCookie(response, sessionToken);
  return response;
}

export async function DELETE(request: Request) {
  await revokeAdminSession(request);
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
