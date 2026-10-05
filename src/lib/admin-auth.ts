import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { adminSessions } from "@/db/schema";

export const ADMIN_COOKIE_NAME = "palawan_collective_admin";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 365;
const LEGACY_SESSION_PAYLOADS = [
  "palawan-collective-admin-session",
  "palawan-collective-admin-session-v2",
  "palawan-collective-admin-session-v3",
];
const CURRENT_SESSION_PAYLOAD = "palawan-collective-admin-session-v3";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function configuredLegacySecrets() {
  return [
    process.env.ADMIN_SESSION_SECRET,
    process.env.DATABASE_URL,
    process.env.ADMIN_PASSKEY,
    "5309",
    "palawan-collective-os-session",
  ].filter((secret): secret is string => Boolean(secret));
}

function sessionSigningSecret() {
  // Match the login credential exactly; never depend on a deployment-specific
  // database URL, ephemeral key, or per-instance generated secret.
  return process.env.ADMIN_PASSKEY || "5309";
}

/** A long-lived signed bearer token that is consistent across app instances. */
export function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE,
    nonce: randomBytes(16).toString("hex"),
  })).toString("base64url");
  const signature = createHmac("sha256", sessionSigningSecret())
    .update(`${CURRENT_SESSION_PAYLOAD}.${payload}`)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export async function storeAdminSession(token: string) {
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000);
  await db.insert(adminSessions).values({
    tokenHash: tokenHash(token),
    expiresAt,
  });
  return expiresAt;
}

function constantTimeTextMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

/**
 * Accept a still-valid signed session from earlier app versions during rollout.
 * Its hash is inserted into PostgreSQL on first use, then checked there like a
 * new session, avoiding a forced re-login after this fix deploys.
 */
function legacySessionExpiry(token: string): Date | null {
  const secrets = configuredLegacySecrets();

  if (/^[a-f0-9]{64}$/i.test(token)) {
    for (const payload of LEGACY_SESSION_PAYLOADS) {
      for (const secret of secrets) {
        const expected = createHmac("sha256", secret).update(payload).digest("hex");
        if (constantTimeTextMatch(token.toLowerCase(), expected.toLowerCase())) {
          return new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000);
        }
      }
    }
    return null;
  }

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined || token.length > 512) return null;

  let payloadObject: { exp?: unknown; nonce?: unknown };
  try {
    payloadObject = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
      nonce?: unknown;
    };
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof payloadObject.exp !== "number" ||
    !Number.isSafeInteger(payloadObject.exp) ||
    payloadObject.exp <= now ||
    payloadObject.exp > now + ADMIN_SESSION_MAX_AGE + 60 ||
    typeof payloadObject.nonce !== "string" ||
    !/^[a-f0-9]{32}$/.test(payloadObject.nonce)
  ) {
    return null;
  }

  const receivedSignature = Buffer.from(signature, "base64url");
  for (const secret of secrets) {
    for (const basePayload of LEGACY_SESSION_PAYLOADS) {
      const expectedSignature = createHmac("sha256", secret)
        .update(`${basePayload}.${payload}`)
        .digest();
      if (
        receivedSignature.length === expectedSignature.length &&
        timingSafeEqual(receivedSignature, expectedSignature)
      ) {
        return new Date(payloadObject.exp * 1000);
      }
    }
  }

  return null;
}

async function findOrMigrateSession(token: string | undefined) {
  if (!token || token.length > 512) return undefined;

  const hashedToken = tokenHash(token);
  const now = new Date();
  const [existing] = await db.select({ tokenHash: adminSessions.tokenHash })
    .from(adminSessions)
    .where(and(
      eq(adminSessions.tokenHash, hashedToken),
      gt(adminSessions.expiresAt, now),
      isNull(adminSessions.revokedAt),
    ))
    .limit(1);
  if (existing) return token;

  const legacyExpiry = legacySessionExpiry(token);
  if (!legacyExpiry) return undefined;

  await db.insert(adminSessions).values({ tokenHash: hashedToken, expiresAt: legacyExpiry })
    .onConflictDoNothing({ target: adminSessions.tokenHash });

  const [migrated] = await db.select({ tokenHash: adminSessions.tokenHash })
    .from(adminSessions)
    .where(and(
      eq(adminSessions.tokenHash, hashedToken),
      gt(adminSessions.expiresAt, new Date()),
      isNull(adminSessions.revokedAt),
    ))
    .limit(1);
  return migrated ? token : undefined;
}

export async function getAdminSessionToken(request?: Request) {
  const authorization = request?.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = bearerToken || request?.headers.get("x-admin-session") || undefined;
  const validHeaderToken = await findOrMigrateSession(headerToken);
  if (validHeaderToken) return validHeaderToken;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return findOrMigrateSession(cookieToken);
}

export async function isAdminRequest(request?: Request) {
  return Boolean(await getAdminSessionToken(request));
}

export async function revokeAdminSession(request?: Request) {
  const token = await getAdminSessionToken(request);
  if (!token) return;
  await db.update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.tokenHash, tokenHash(token)));
}
