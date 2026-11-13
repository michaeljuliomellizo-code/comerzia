import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Profile } from "@prisma/client";

// ── Contraseñas (scrypt, formato s1$salt$hash — coincide con supabase/04) ────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `s1$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [version, salt, hash] = stored.split("$");
  if (version !== "s1" || !salt || !hash) return false;
  const original = Buffer.from(hash, "hex");
  const attempt = scryptSync(password, salt, 64);
  return original.length === attempt.length && timingSafeEqual(original, attempt);
}

// ── Sesiones con cookie httpOnly ─────────────────────────────────────────────

export const SESSION_COOKIE = "comerzia_session";
const SESSION_DAYS = 7;

export async function createSessionForProfile(profileId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({ data: { userId: profileId, token, expiresAt } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  store.delete(SESSION_COOKIE);
}

// Lee la cookie, valida la sesión y devuelve el perfil vigente (o null).
export async function getSessionProfile(): Promise<Profile | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { profile: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.deleteMany({ where: { token } });
    return null;
  }
  if (session.profile.status !== "activo") {
    await db.session.deleteMany({ where: { token } });
    return null;
  }
  return session.profile;
}
