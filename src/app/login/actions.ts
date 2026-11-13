"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword, createSessionForProfile, clearSession } from "@/lib/auth";
import { logAudit } from "@/lib/tenant";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const profile = await db.profile.findUnique({ where: { email } });

  if (!profile || !verifyPassword(password, profile.passwordHash)) {
    await logAudit({ action: "login_fallido", entity: "profiles", changes: { email } });
    return { error: "Credenciales incorrectas. Verifica tu correo y contraseña." };
  }

  if (profile.status !== "activo") {
    return { error: "Tu cuenta está suspendida. Contacta a soporte@comerzia.com." };
  }

  let destination = "/admin";

  if (!profile.isSuperAdmin) {
    const member = await db.organizationMember.findFirst({
      where: { userId: profile.id, active: true },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });

    if (!member) {
      return { error: "Tu usuario no pertenece a ninguna organización activa. Contacta a soporte@comerzia.com." };
    }

    if (member.organization.status === "suspendida") {
      return {
        error: `La organización "${member.organization.name}" está suspendida por morosidad. Contacta a soporte@comerzia.com para reactivarla.`,
      };
    }

    destination = "/panel";
  }

  await createSessionForProfile(profile.id);
  await db.profile.update({
    where: { id: profile.id },
    data: { lastLoginAt: new Date() },
  });

  await logAudit({
    action: "login",
    entity: "profiles",
    entityId: profile.id,
    changes: { email: profile.email, rol: profile.isSuperAdmin ? "SUPER_ADMIN" : "USUARIO_ORGANIZACION" },
    actor: { id: profile.id, email: profile.email },
  });

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
