"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireSuperAdminPage, logAudit } from "@/lib/tenant";
import type { Profile } from "@prisma/client";

// ════════════════════════════════════════════════════════════════════════════
// Utilidades internas
// ════════════════════════════════════════════════════════════════════════════

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "organizacion";
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 2;
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

async function nextInvoiceNumber(): Promise<string> {
  const count = await db.saasInvoice.count();
  return `S-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
}

async function nextTicketNumber(): Promise<string> {
  const count = await db.supportTicket.count();
  return `T-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
}

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function finish(back: string, msg: string): never {
  revalidatePath("/admin", "layout");
  redirect(`${back}?msg=${encodeURIComponent(msg)}`);
}

function fail(back: string, err: unknown): never {
  const message = err instanceof Error ? err.message : "No se pudo completar la operación.";
  revalidatePath("/admin", "layout");
  redirect(`${back}?err=${encodeURIComponent(message)}`);
}

async function sa(): Promise<Profile> {
  return requireSuperAdminPage();
}

const PLATFORM = "/admin";
const ORGS = "/admin/organizaciones";
const SUBS = "/admin/suscripciones";
const INVOICES = "/admin/facturacion";
const PAYMENTS = "/admin/pagos";
const USERS = "/admin/usuarios";
const PLANS = "/admin/planes";
const MODULES = "/admin/modulos";
const LIMITS = "/admin/limites";
const COUPONS = "/admin/cupones";
const TRIALS = "/admin/pruebas";
const RENEWALS = "/admin/renovaciones";
const CANCELS = "/admin/cancelaciones";
const DELINQ = "/admin/morosidad";
const SUPPORT = "/admin/soporte";
const NOTIFY = "/admin/notificaciones";
const INTEGR = "/admin/integraciones";
const SETTINGS = "/admin/configuracion";

// ════════════════════════════════════════════════════════════════════════════
// Organizaciones
// ════════════════════════════════════════════════════════════════════════════

export async function createOrganization(formData: FormData): Promise<void> {
  try {
    const admin = await sa();
    const name = str(formData.get("name"));
    const email = str(formData.get("email")).toLowerCase();
    const ownerName = str(formData.get("ownerName")) || "Propietario";
    const ownerEmail = (str(formData.get("ownerEmail")) || email).toLowerCase();
    const ownerPassword = str(formData.get("ownerPassword")) || "demo123";
    const planCode = str(formData.get("planCode")) || "basico";
    const trialDays = num(formData.get("trialDays")) ?? 0;
    const notes = str(formData.get("notes")) || null;

    if (!name) throw new Error("El nombre del negocio es obligatorio.");
    if (!ownerEmail) throw new Error("El correo del propietario es obligatorio.");

    const plan = await db.plan.findUnique({ where: { code: planCode } });
    if (!plan) throw new Error("El plan seleccionado no existe.");

    const org = await db.organization.create({
      data: {
        name,
        slug: await uniqueSlug(slugify(name)),
        email: email || ownerEmail,
        status: trialDays > 0 ? "prueba" : "activa",
        trialEndsAt: trialDays > 0 ? new Date(Date.now() + trialDays * 86_400_000) : null,
        notes,
      },
    });

    await db.organizationSetting.create({
      data: { organizationId: org.id, storeName: name },
    });

    const subscription = await db.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: trialDays > 0 ? "prueba" : "activa",
        currentPeriodEnd: trialDays > 0 ? null : new Date(Date.now() + 30 * 86_400_000),
      },
    });

    // Módulos habilitados por defecto
    const modules = await db.platformModule.findMany({ where: { isActive: true } });
    if (modules.length) {
      await db.organizationModule.createMany({
        data: modules.map((m) => ({ organizationId: org.id, moduleId: m.id, enabled: true })),
      });
    }

    // Propietario
    let owner = await db.profile.findUnique({ where: { email: ownerEmail } });
    if (!owner) {
      owner = await db.profile.create({
        data: {
          email: ownerEmail,
          fullName: ownerName,
          passwordHash: hashPassword(ownerPassword),
        },
      });
    }
    await db.organizationMember.create({
      data: { organizationId: org.id, userId: owner.id, role: "OWNER", active: true },
    });

    await logAudit({
      action: "create",
      entity: "organizations",
      entityId: org.id,
      organizationId: org.id,
      changes: { name, plan: plan.code, trialDays },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(ORGS, e);
  }
  finish(ORGS, `Organización "${str(formData.get("name"))}" creada correctamente.`);
}

export async function setOrganizationStatus(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || ORGS;
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    const status = str(formData.get("status")); // activa | suspendida | prueba | cancelada

    if (!["activa", "suspendida", "prueba", "cancelada"].includes(status)) {
      throw new Error("Estado no válido.");
    }

    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new Error("Organización no encontrada.");

    await db.organization.update({
      where: { id: organizationId },
      data: {
        status,
        suspendedAt: status === "suspendida" ? new Date() : null,
      },
    });

    // Sincronizar la suscripción con el estado de la organización
    const sub = await db.subscription.findUnique({ where: { organizationId } });
    if (sub) {
      if (status === "suspendida" && sub.status === "activa") {
        await db.subscription.update({ where: { id: sub.id }, data: { status: "vencida" } });
      }
      if (status === "activa" && ["vencida"].includes(sub.status)) {
        await db.subscription.update({
          where: { id: sub.id },
          data: {
            status: "activa",
            currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
          },
        });
      }
      if (status === "cancelada" && sub.status !== "cancelada") {
        await db.subscription.update({ where: { id: sub.id }, data: { status: "cancelada" } });
      }
    }

    await logAudit({
      action: status === "activa" ? "activate" : status === "suspendida" ? "suspend" : "update",
      entity: "organizations",
      entityId: organizationId,
      organizationId,
      changes: { status },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, `Estado actualizado a "${str(formData.get("status"))}".`);
}

export async function updateOrganization(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || ORGS;
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    const email = str(formData.get("email")).toLowerCase() || null;
    const notes = str(formData.get("notes")) || null;
    await db.organization.update({ where: { id: organizationId }, data: { email, notes } });
    await logAudit({
      action: "update",
      entity: "organizations",
      entityId: organizationId,
      organizationId,
      changes: { email, notes },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Datos de la organización actualizados.");
}

export async function changeOrganizationPlan(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || ORGS;
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    const planCode = str(formData.get("planCode"));
    const plan = await db.plan.findUnique({ where: { code: planCode } });
    if (!plan) throw new Error("Plan no encontrado.");

    const sub = await db.subscription.upsert({
      where: { organizationId },
      update: { planId: plan.id },
      create: { organizationId, planId: plan.id, status: "activa", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
    });

    // Reacción de la organización si estaba en prueba
    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (org && org.status === "prueba") {
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: "activa", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
      });
      await db.organization.update({ where: { id: organizationId }, data: { status: "activa", trialEndsAt: null } });
    }

    await logAudit({
      action: "update",
      entity: "subscriptions",
      entityId: sub.id,
      organizationId,
      changes: { plan: planCode },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, `Plan cambiado a "${str(formData.get("planCode"))}".`);
}

// ════════════════════════════════════════════════════════════════════════════
// Pruebas gratuitas
// ════════════════════════════════════════════════════════════════════════════

export async function assignTrial(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || TRIALS;
  let okMsg = "";
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    const days = num(formData.get("days")) ?? 15;
    if (days <= 0 || days > 180) throw new Error("Los días de prueba deben estar entre 1 y 180.");

    const trialEndsAt = new Date(Date.now() + days * 86_400_000);
    await db.organization.update({
      where: { id: organizationId },
      data: { status: "prueba", trialEndsAt },
    });
    await db.subscription.upsert({
      where: { organizationId },
      update: { status: "prueba" },
      create: {
        organizationId,
        planId: (await db.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }))!.id,
        status: "prueba",
      },
    });
    okMsg = `Prueba asignada por ${days} días.`;

    await logAudit({
      action: "assign_trial",
      entity: "organizations",
      entityId: organizationId,
      organizationId,
      changes: { days, trialEndsAt },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

// ════════════════════════════════════════════════════════════════════════════
// Suscripciones
// ════════════════════════════════════════════════════════════════════════════

export async function toggleAutoRenew(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || SUBS;
  let okMsg = "";
  try {
    const admin = await sa();
    const subscriptionId = str(formData.get("subscriptionId"));
    const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new Error("Suscripción no encontrada.");
    await db.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAtPeriodEnd: !sub.cancelAtPeriodEnd },
    });
    okMsg = sub.cancelAtPeriodEnd ? "Renovación automática reactivada." : "Renovación automática desactivada.";
    await logAudit({
      action: "update",
      entity: "subscriptions",
      entityId: subscriptionId,
      organizationId: sub.organizationId,
      changes: { cancelAtPeriodEnd: !sub.cancelAtPeriodEnd },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function renewSubscription(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || RENEWALS;
  try {
    const admin = await sa();
    const subscriptionId = str(formData.get("subscriptionId"));
    const sub = await db.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true, organization: true } });
    if (!sub) throw new Error("Suscripción no encontrada.");

    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const newPeriodEnd = new Date(base.getTime() + 30 * 86_400_000);

    await db.subscription.update({
      where: { id: subscriptionId },
      data: { status: "activa", currentPeriodEnd: newPeriodEnd, cancelAtPeriodEnd: false },
    });
    if (sub.organization.status === "suspendida" || sub.organization.status === "prueba") {
      await db.organization.update({ where: { id: sub.organizationId }, data: { status: "activa", suspendedAt: null } });
    }

    // Factura del nuevo período
    const amount = sub.plan.monthlyPrice;
    const invoice = await db.saasInvoice.create({
      data: {
        number: await nextInvoiceNumber(),
        organizationId: sub.organizationId,
        subscriptionId: sub.id,
        periodStart: base,
        periodEnd: newPeriodEnd,
        amount,
        taxRate: 19,
        taxAmount: Math.round(amount * 0.19 * 100) / 100,
        total: Math.round(amount * 1.19 * 100) / 100,
        status: "pendiente",
        dueAt: new Date(Date.now() + 5 * 86_400_000),
      },
    });

    await db.saasRenewal.create({
      data: {
        organizationId: sub.organizationId,
        subscriptionId: sub.id,
        previousPeriodEnd: sub.currentPeriodEnd,
        newPeriodEnd,
        invoiceNumber: invoice.number,
      },
    });

    await logAudit({
      action: "renew",
      entity: "subscriptions",
      entityId: sub.id,
      organizationId: sub.organizationId,
      changes: { newPeriodEnd, invoice: invoice.number },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Suscripción renovada y factura generada.");
}

export async function cancelSubscription(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || CANCELS;
  let okMsg = "";
  try {
    const admin = await sa();
    const subscriptionId = str(formData.get("subscriptionId"));
    const type = str(formData.get("type")) === "inmediata" ? "inmediata" : "fin_periodo";
    const reason = str(formData.get("reason")) || null;

    const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new Error("Suscripción no encontrada.");

    if (type === "inmediata") {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "cancelada", cancelAtPeriodEnd: false } });
      await db.organization.update({ where: { id: sub.organizationId }, data: { status: "cancelada" } });
      await db.saasCancellation.create({
        data: { organizationId: sub.organizationId, subscriptionId: sub.id, type, reason, status: "efectiva", effectiveAt: new Date() },
      });
    } else {
      await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
      await db.saasCancellation.create({
        data: {
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          type,
          reason,
          status: "programada",
          effectiveAt: sub.currentPeriodEnd,
        },
      });
    }

    await logAudit({
      action: "cancel",
      entity: "subscriptions",
      entityId: sub.id,
      organizationId: sub.organizationId,
      changes: { type, reason },
      actor: { id: admin.id, email: admin.email },
    });
    okMsg = type === "inmediata" ? "Suscripción cancelada de inmediato." : "Cancelación programada para el fin del período.";
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function revokeCancellation(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || CANCELS;
  try {
    const admin = await sa();
    const cancellationId = str(formData.get("cancellationId"));
    const c = await db.saasCancellation.findUnique({ where: { id: cancellationId } });
    if (!c) throw new Error("Cancelación no encontrada.");

    await db.saasCancellation.update({
      where: { id: cancellationId },
      data: { status: "revertida", revokedAt: new Date() },
    });
    if (c.subscriptionId) {
      const sub = await db.subscription.findUnique({ where: { id: c.subscriptionId } });
      if (sub) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { cancelAtPeriodEnd: false, status: sub.status === "cancelada" ? "activa" : sub.status },
        });
        const org = await db.organization.findUnique({ where: { id: sub.organizationId } });
        if (org && org.status === "cancelada") {
          await db.organization.update({ where: { id: org.id }, data: { status: "activa" } });
        }
      }
    }
    await logAudit({
      action: "revoke_cancellation",
      entity: "saas_cancellations",
      entityId: cancellationId,
      organizationId: c.organizationId,
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Cancelación revertida. La suscripción sigue activa.");
}

// ════════════════════════════════════════════════════════════════════════════
// Facturación SaaS
// ════════════════════════════════════════════════════════════════════════════

export async function generateInvoices(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || INVOICES;
  let okMsg = "";
  try {
    const admin = await sa();
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 86_400_000);

    const subs = await db.subscription.findMany({
      where: { status: "activa", currentPeriodEnd: { lte: horizon } },
      include: { plan: true, organization: true },
    });

    let created = 0;
    for (const sub of subs) {
      const periodStart = sub.currentPeriodEnd ?? now;
      const periodEnd = new Date(periodStart.getTime() + 30 * 86_400_000);
      const amount = sub.plan.monthlyPrice;

      await db.saasInvoice.create({
        data: {
          number: await nextInvoiceNumber(),
          organizationId: sub.organizationId,
          subscriptionId: sub.id,
          periodStart,
          periodEnd,
          amount,
          taxRate: 19,
          taxAmount: Math.round(amount * 0.19 * 100) / 100,
          total: Math.round(amount * 1.19 * 100) / 100,
          status: "pendiente",
          dueAt: new Date(periodStart.getTime() + 5 * 86_400_000),
        },
      });
      await db.subscription.update({
        where: { id: sub.id },
        data: { currentPeriodEnd: periodEnd },
      });
      created++;
    }

    await logAudit({
      action: "generate_invoices",
      entity: "saas_invoices",
      changes: { created },
      actor: { id: admin.id, email: admin.email },
    });

    okMsg = created ? `Se generaron ${created} facturas del período.` : "No hay suscripciones con período próximo a vencer.";
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function voidInvoice(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || INVOICES;
  try {
    const admin = await sa();
    const invoiceId = str(formData.get("invoiceId"));
    const inv = await db.saasInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new Error("Factura no encontrada.");
    await db.saasInvoice.update({ where: { id: invoiceId }, data: { status: "anulada" } });
    await logAudit({
      action: "void_invoice",
      entity: "saas_invoices",
      entityId: invoiceId,
      organizationId: inv.organizationId,
      changes: { number: inv.number },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Factura anulada.");
}

// ════════════════════════════════════════════════════════════════════════════
// Pagos
// ════════════════════════════════════════════════════════════════════════════

export async function registerPayment(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || PAYMENTS;
  try {
    const admin = await sa();
    const invoiceId = str(formData.get("invoiceId"));
    const method = str(formData.get("method")) || "transferencia";
    const reference = str(formData.get("reference")) || null;
    const notes = str(formData.get("notes")) || null;

    const inv = await db.saasInvoice.findUnique({ where: { id: invoiceId }, include: { organization: true } });
    if (!inv) throw new Error("Factura no encontrada.");
    if (inv.status === "pagada") throw new Error("La factura ya está pagada.");
    if (inv.status === "anulada") throw new Error("No se puede pagar una factura anulada.");

    await db.$transaction(async (tx) => {
      await tx.saasPayment.create({
        data: {
          organizationId: inv.organizationId,
          invoiceId: inv.id,
          amount: inv.total,
          method,
          reference,
          status: "confirmado",
          notes,
          receivedAt: new Date(),
        },
      });
      await tx.saasInvoice.update({
        where: { id: inv.id },
        data: { status: "pagada", paidAt: new Date() },
      });
      // Si la organización estaba vencida/suspendida, reactivar
      const org = await tx.organization.findUnique({ where: { id: inv.organizationId } });
      if (org && org.status === "suspendida") {
        await tx.organization.update({
          where: { id: org.id },
          data: { status: "activa", suspendedAt: null },
        });
        await tx.subscription.updateMany({
          where: { organizationId: org.id, status: "vencida" },
          data: { status: "activa" },
        });
      }
    });

    await logAudit({
      action: "register_payment",
      entity: "saas_payments",
      entityId: inv.id,
      organizationId: inv.organizationId,
      changes: { invoice: inv.number, method, total: inv.total },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Pago registrado y factura marcada como pagada.");
}

export async function setPaymentStatus(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || PAYMENTS;
  let okMsg = "";
  try {
    const admin = await sa();
    const paymentId = str(formData.get("paymentId"));
    const status = str(formData.get("status")); // confirmado | rechazado
    if (!["confirmado", "rechazado", "pendiente"].includes(status)) throw new Error("Estado no válido.");

    const pay = await db.saasPayment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
    if (!pay) throw new Error("Pago no encontrado.");

    await db.saasPayment.update({ where: { id: paymentId }, data: { status } });

    if (pay.invoiceId && pay.invoice) {
      if (status === "confirmado") {
        await db.saasInvoice.update({
          where: { id: pay.invoiceId },
          data: { status: "pagada", paidAt: pay.invoice.paidAt ?? new Date() },
        });
      } else if (status === "rechazado" && pay.invoice.status === "pagada") {
        await db.saasInvoice.update({ where: { id: pay.invoiceId }, data: { status: "pendiente", paidAt: null } });
      }
    }

    await logAudit({
      action: "update_payment_status",
      entity: "saas_payments",
      entityId: paymentId,
      organizationId: pay.organizationId,
      changes: { status },
      actor: { id: admin.id, email: admin.email },
    });
    okMsg = `Pago ${status === "confirmado" ? "confirmado" : status === "rechazado" ? "rechazado" : "marcado como pendiente"}.`;
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

// ════════════════════════════════════════════════════════════════════════════
// Usuarios globales
// ════════════════════════════════════════════════════════════════════════════

export async function createUser(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || USERS;
  try {
    const admin = await sa();
    const fullName = str(formData.get("fullName"));
    const email = str(formData.get("email")).toLowerCase();
    const password = str(formData.get("password")) || "demo123";
    const organizationId = str(formData.get("organizationId"));
    const role = str(formData.get("role")) || "CAJERO";

    if (!fullName || !email) throw new Error("Nombre y correo son obligatorios.");
    if (role === "OWNER" && !organizationId) throw new Error("El rol OWNER requiere una organización.");
    if (await db.profile.findUnique({ where: { email } })) {
      throw new Error("Ya existe un usuario con ese correo.");
    }

    const profile = await db.profile.create({
      data: { email, fullName, passwordHash: hashPassword(password) },
    });

    if (organizationId) {
      await db.organizationMember.create({
        data: { organizationId, userId: profile.id, role, active: true },
      });
    }

    await logAudit({
      action: "create",
      entity: "profiles",
      entityId: profile.id,
      organizationId: organizationId || null,
      changes: { email, role },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Usuario creado correctamente.");
}

export async function setUserStatus(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || USERS;
  let okMsg = "";
  try {
    const admin = await sa();
    const profileId = str(formData.get("profileId"));
    const status = str(formData.get("status")); // activo | suspendido
    if (!["activo", "suspendido"].includes(status)) throw new Error("Estado no válido.");

    await db.profile.update({ where: { id: profileId }, data: { status } });
    if (status === "suspendido") {
      await db.session.deleteMany({ where: { userId: profileId } });
    }

    await logAudit({
      action: status === "suspendido" ? "suspend_user" : "activate_user",
      entity: "profiles",
      entityId: profileId,
      changes: { status },
      actor: { id: admin.id, email: admin.email },
    });
    okMsg = `Usuario ${status === "activo" ? "activado" : "suspendido"} (sesiones cerradas si aplica).`;
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function resetUserPassword(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || USERS;
  try {
    const admin = await sa();
    const profileId = str(formData.get("profileId"));
    const password = str(formData.get("password")) || "demo123";
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    await db.profile.update({ where: { id: profileId }, data: { passwordHash: hashPassword(password) } });
    await db.session.deleteMany({ where: { userId: profileId } });
    await logAudit({
      action: "reset_password",
      entity: "profiles",
      entityId: profileId,
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Contraseña restablecida y sesiones cerradas.");
}

// ════════════════════════════════════════════════════════════════════════════
// Planes
// ════════════════════════════════════════════════════════════════════════════

export async function updatePlan(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || PLANS;
  try {
    const admin = await sa();
    const planId = str(formData.get("planId"));
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Plan no encontrado.");

    const monthlyPrice = num(formData.get("monthlyPrice"));
    if (monthlyPrice === null || monthlyPrice < 0) throw new Error("El precio mensual no es válido.");

    await db.plan.update({
      where: { id: planId },
      data: {
        monthlyPrice,
        maxUsers: num(formData.get("maxUsers")),
        maxProducts: num(formData.get("maxProducts")),
        maxBranches: num(formData.get("maxBranches")),
        maxCustomers: num(formData.get("maxCustomers")),
        maxPos: num(formData.get("maxPos")),
        storageGb: num(formData.get("storageGb")),
        description: str(formData.get("description")) || plan.description,
        isActive: formData.get("isActive") === "on",
      },
    });

    await logAudit({
      action: "update",
      entity: "plans",
      entityId: planId,
      changes: { plan: plan.code, monthlyPrice, note: "Precio/límites del plan actualizados" },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Plan actualizado.");
}

// ════════════════════════════════════════════════════════════════════════════
// Módulos
// ════════════════════════════════════════════════════════════════════════════

export async function togglePlatformModule(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || MODULES;
  let okMsg = "";
  try {
    const admin = await sa();
    const moduleId = str(formData.get("moduleId"));
    const mod = await db.platformModule.findUnique({ where: { id: moduleId } });
    if (!mod) throw new Error("Módulo no encontrado.");
    await db.platformModule.update({ where: { id: moduleId }, data: { isActive: !mod.isActive } });
    okMsg = mod.isActive ? "Módulo desactivado en toda la plataforma." : "Módulo activado en toda la plataforma.";
    await logAudit({
      action: mod.isActive ? "disable_module" : "enable_module",
      entity: "platform_modules",
      entityId: moduleId,
      changes: { code: mod.code, isActive: !mod.isActive },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function setOrgModule(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || MODULES;
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    const moduleId = str(formData.get("moduleId"));
    const enabled = formData.get("enabled") === "on";

    await db.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId, moduleId } },
      update: { enabled },
      create: { organizationId, moduleId, enabled },
    });

    const mod = await db.platformModule.findUnique({ where: { id: moduleId } });
    await logAudit({
      action: enabled ? "enable_org_module" : "disable_org_module",
      entity: "organization_modules",
      entityId: moduleId,
      organizationId,
      changes: { module: mod?.code, enabled },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Módulos de la organización actualizados.");
}

// ════════════════════════════════════════════════════════════════════════════
// Límites
// ════════════════════════════════════════════════════════════════════════════

export async function setLimitOverride(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || LIMITS;
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    const expiresAtRaw = str(formData.get("expiresAt"));

    const data = {
      maxUsers: num(formData.get("maxUsers")),
      maxProducts: num(formData.get("maxProducts")),
      maxBranches: num(formData.get("maxBranches")),
      storageGb: num(formData.get("storageGb")),
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
      note: str(formData.get("note")) || null,
    };

    await db.organizationLimitOverride.upsert({
      where: { organizationId },
      update: data,
      create: { organizationId, ...data },
    });

    await logAudit({
      action: "set_limit_override",
      entity: "organization_limit_overrides",
      entityId: organizationId,
      organizationId,
      changes: data as Record<string, unknown>,
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Límites temporales guardados.");
}

export async function removeLimitOverride(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || LIMITS;
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    await db.organizationLimitOverride.deleteMany({ where: { organizationId } });
    await logAudit({
      action: "remove_limit_override",
      entity: "organization_limit_overrides",
      entityId: organizationId,
      organizationId,
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Ampliación de límites eliminada. Rigen los límites del plan.");
}

// ════════════════════════════════════════════════════════════════════════════
// Cupones comerciales
// ════════════════════════════════════════════════════════════════════════════

export async function createPlatformCoupon(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || COUPONS;
  try {
    const admin = await sa();
    const code = str(formData.get("code")).toUpperCase();
    const discountType = str(formData.get("discountType")) === "monto" ? "monto" : "porcentaje";
    const value = num(formData.get("value")) ?? 0;
    if (!code) throw new Error("El código del cupón es obligatorio.");
    if (value <= 0) throw new Error("El valor del descuento debe ser mayor a cero.");
    if (discountType === "porcentaje" && value > 100) throw new Error("El porcentaje no puede ser mayor a 100.");
    if (await db.platformCoupon.findUnique({ where: { code } })) throw new Error("Ya existe un cupón con ese código.");

    const endsAtRaw = str(formData.get("endsAt"));
    const maxRedemptions = num(formData.get("maxRedemptions"));

    await db.platformCoupon.create({
      data: {
        code,
        discountType,
        value,
        maxRedemptions: maxRedemptions === null ? null : Math.max(1, Math.floor(maxRedemptions)),
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        notes: str(formData.get("notes")) || null,
        isActive: true,
      },
    });

    await logAudit({
      action: "create",
      entity: "platform_coupons",
      changes: { code, discountType, value },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Cupón creado.");
}

export async function togglePlatformCoupon(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || COUPONS;
  let okMsg = "";
  try {
    const admin = await sa();
    const couponId = str(formData.get("couponId"));
    const c = await db.platformCoupon.findUnique({ where: { id: couponId } });
    if (!c) throw new Error("Cupón no encontrado.");
    await db.platformCoupon.update({ where: { id: couponId }, data: { isActive: !c.isActive } });
    okMsg = c.isActive ? "Cupón desactivado." : "Cupón activado.";
    await logAudit({
      action: c.isActive ? "disable_coupon" : "enable_coupon",
      entity: "platform_coupons",
      entityId: couponId,
      changes: { code: c.code },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function deletePlatformCoupon(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || COUPONS;
  try {
    const admin = await sa();
    const couponId = str(formData.get("couponId"));
    await db.platformCoupon.delete({ where: { id: couponId } });
    await logAudit({
      action: "delete",
      entity: "platform_coupons",
      entityId: couponId,
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Cupón eliminado.");
}

// ════════════════════════════════════════════════════════════════════════════
// Morosidad
// ════════════════════════════════════════════════════════════════════════════

export async function processDelinquency(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || DELINQ;
  let okMsg = "";
  try {
    const admin = await sa();
    const now = new Date();
    const graceDays = Number((await db.platformSetting.findUnique({ where: { key: "grace_period_days" } }))?.value ?? 5);
    const grace = new Date(now.getTime() + graceDays * 86_400_000); // hmm: grace desde el vencimiento

    // 1. Facturas pendientes con vencimiento cumplido → vencida
    const overdueUpdated = await db.saasInvoice.updateMany({
      where: { status: "pendiente", dueAt: { lt: now } },
      data: { status: "vencida" },
    });

    // 2. Suscripciones activas cuyo período terminó hace más del período de gracia → vencida
    const graceCutoff = new Date(now.getTime() - graceDays * 86_400_000);
    const subsExpired = await db.subscription.updateMany({
      where: { status: "activa", currentPeriodEnd: { lt: graceCutoff } },
      data: { status: "vencida" },
    });

    // 3. Suscripciones vencidas cuyo período terminó hace más del doble de la gracia → organización suspendida
    const suspendCutoff = new Date(now.getTime() - (graceDays * 2) * 86_400_000);
    const toSuspend = await db.subscription.findMany({
      where: { status: "vencida", organization: { status: "activa" } },
      include: { organization: true },
    });
    let suspended = 0;
    for (const sub of toSuspend) {
      if (sub.currentPeriodEnd && sub.currentPeriodEnd < suspendCutoff) {
        await db.organization.update({
          where: { id: sub.organizationId },
          data: { status: "suspendida", suspendedAt: now },
        });
        suspended++;
      }
    }

    await logAudit({
      action: "process_delinquency",
      entity: "saas_invoices",
      changes: { invoicesOverdue: overdueUpdated.count, subsExpired: subsExpired.count, orgsSuspended: suspended, graceDays, ref: grace.toISOString().slice(0, 10) },
      actor: { id: admin.id, email: admin.email },
    });

    okMsg = `Morosidad procesada: ${overdueUpdated.count} facturas vencidas, ${subsExpired.count} suscripciones vencidas, ${suspended} organizaciones suspendidas.`;
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

// ════════════════════════════════════════════════════════════════════════════
// Soporte
// ════════════════════════════════════════════════════════════════════════════

export async function createTicket(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || SUPPORT;
  try {
    const admin = await sa();
    const organizationId = str(formData.get("organizationId"));
    const subject = str(formData.get("subject"));
    const description = str(formData.get("description"));
    const priority = str(formData.get("priority")) || "media";
    const category = str(formData.get("category")) || "general";

    if (!organizationId) throw new Error("Selecciona la organización.");
    if (!subject) throw new Error("El asunto es obligatorio.");
    if (!["baja", "media", "alta", "urgente"].includes(priority)) throw new Error("Prioridad no válida.");

    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new Error("Organización no encontrada.");

    await db.supportTicket.create({
      data: {
        number: await nextTicketNumber(),
        organizationId,
        subject,
        description,
        priority,
        category,
        status: "abierto",
        createdBy: admin.email,
      },
    });

    await logAudit({
      action: "create_ticket",
      entity: "support_tickets",
      organizationId,
      changes: { subject, priority },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Ticket creado.");
}

export async function replyTicket(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || SUPPORT;
  let okMsg = "";
  try {
    const admin = await sa();
    const ticketId = str(formData.get("ticketId"));
    const body = str(formData.get("body"));
    const isInternal = formData.get("isInternal") === "on";
    okMsg = isInternal ? "Nota interna agregada." : "Respuesta enviada al cliente.";

    const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error("Ticket no encontrado.");
    if (!body) throw new Error("El mensaje no puede estar vacío.");

    await db.supportTicketMessage.create({
      data: {
        ticketId,
        authorName: admin.email,
        authorRole: "soporte",
        body,
        isInternal,
      },
    });

    await db.supportTicket.update({
      where: { id: ticketId },
      data: { status: ticket.status === "abierto" ? "pendiente" : ticket.status },
    });

    await logAudit({
      action: "reply_ticket",
      entity: "support_tickets",
      entityId: ticketId,
      organizationId: ticket.organizationId,
      changes: { internal: isInternal, length: body.length },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function setTicketStatus(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || SUPPORT;
  let okMsg = "";
  try {
    const admin = await sa();
    const ticketId = str(formData.get("ticketId"));
    const status = str(formData.get("status"));
    if (!["abierto", "pendiente", "resuelto", "cerrado"].includes(status)) throw new Error("Estado no válido.");

    await db.supportTicket.update({
      where: { id: ticketId },
      data: { status, closedAt: ["cerrado", "resuelto"].includes(status) ? new Date() : null },
    });

    await logAudit({
      action: "update_ticket_status",
      entity: "support_tickets",
      entityId: ticketId,
      changes: { status },
      actor: { id: admin.id, email: admin.email },
    });
    okMsg = `Ticket marcado como ${status}.`;
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function setTicketPriority(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || SUPPORT;
  let okMsg = "";
  try {
    const admin = await sa();
    const ticketId = str(formData.get("ticketId"));
    const priority = str(formData.get("priority"));
    if (!["baja", "media", "alta", "urgente"].includes(priority)) throw new Error("Prioridad no válida.");
    await db.supportTicket.update({ where: { id: ticketId }, data: { priority } });
    okMsg = `Prioridad cambiada a ${priority}.`;
    await logAudit({
      action: "update_ticket_priority",
      entity: "support_tickets",
      entityId: ticketId,
      changes: { priority },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

// ════════════════════════════════════════════════════════════════════════════
// Notificaciones
// ════════════════════════════════════════════════════════════════════════════

export async function sendNotification(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || NOTIFY;
  try {
    const admin = await sa();
    const title = str(formData.get("title"));
    const body = str(formData.get("body"));
    const audience = str(formData.get("audience")) === "organizacion" ? "organizacion" : "todas";
    const organizationId = audience === "organizacion" ? str(formData.get("organizationId")) : null;
    const channel = str(formData.get("channel")) === "email" ? "email" : "in_app";

    if (!title) throw new Error("El título es obligatorio.");
    if (audience === "organizacion" && !organizationId) throw new Error("Selecciona la organización destinataria.");

    await db.platformNotification.create({
      data: { title, body, audience, organizationId, channel, status: "enviada", sentAt: new Date(), createdBy: admin.email },
    });

    await logAudit({
      action: "send_notification",
      entity: "platform_notifications",
      organizationId,
      changes: { title, audience, channel },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Notificación enviada.");
}

// ════════════════════════════════════════════════════════════════════════════
// Integraciones
// ════════════════════════════════════════════════════════════════════════════

export async function toggleIntegration(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || INTEGR;
  let okMsg = "";
  try {
    const admin = await sa();
    const integrationId = str(formData.get("integrationId"));
    const it = await db.platformIntegration.findUnique({ where: { id: integrationId } });
    if (!it) throw new Error("Integración no encontrada.");
    await db.platformIntegration.update({ where: { id: integrationId }, data: { isActive: !it.isActive } });
    okMsg = it.isActive ? "Integración desactivada." : "Integración activada.";
    await logAudit({
      action: it.isActive ? "disable_integration" : "enable_integration",
      entity: "platform_integrations",
      entityId: integrationId,
      changes: { code: it.code },
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}

export async function saveIntegrationConfig(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || INTEGR;
  try {
    const admin = await sa();
    const integrationId = str(formData.get("integrationId"));
    const raw = str(formData.get("config")) || "{}";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("La configuración debe ser JSON válido.");
    }

    await db.platformIntegration.update({
      where: { id: integrationId },
      data: { config: parsed as object },
    });

    await logAudit({
      action: "update_integration_config",
      entity: "platform_integrations",
      entityId: integrationId,
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Configuración guardada.");
}

export async function clearIntegrationError(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || INTEGR;
  try {
    const admin = await sa();
    const integrationId = str(formData.get("integrationId"));
    await db.platformIntegration.update({
      where: { id: integrationId },
      data: { lastErrorAt: null, lastErrorMessage: null },
    });
    await logAudit({
      action: "clear_integration_error",
      entity: "platform_integrations",
      entityId: integrationId,
      actor: { id: admin.id, email: admin.email },
    });
  } catch (e) {
    fail(back, e);
  }
  finish(back, "Error de integración marcado como revisado.");
}

// ════════════════════════════════════════════════════════════════════════════
// Configuración de la plataforma
// ════════════════════════════════════════════════════════════════════════════

export async function updatePlatformSettings(formData: FormData): Promise<void> {
  const back = str(formData.get("back")) || SETTINGS;
  let okMsg = "";
  try {
    const admin = await sa();
    const keys = formData.getAll("settingKeys").map((k) => String(k));
    let changed = 0;

    for (const key of keys) {
      const value = str(formData.get(`setting_${key}`));
      const existing = await db.platformSetting.findUnique({ where: { key } });
      if (!existing || existing.value !== value) {
        await db.platformSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        changed++;
      }
    }

    await logAudit({
      action: "update_platform_settings",
      entity: "platform_settings",
      changes: { keys, changed },
      actor: { id: admin.id, email: admin.email },
    });

    okMsg = changed ? `Configuración guardada (${changed} parámetros actualizados).` : "Sin cambios por guardar.";
  } catch (e) {
    fail(back, e);
  }
  finish(back, okMsg);
}
