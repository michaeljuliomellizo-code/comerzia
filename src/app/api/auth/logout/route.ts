import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { getSessionProfile } from "@/lib/auth";
import { logAudit } from "@/lib/tenant";

// POST /api/auth/logout — cierra la sesión actual
export async function POST() {
  const profile = await getSessionProfile();
  await clearSession();
  if (profile) {
    await logAudit({
      action: "logout",
      entity: "profiles",
      entityId: profile.id,
      actor: { id: profile.id, email: profile.email },
    });
  }
  return NextResponse.json({ ok: true });
}
