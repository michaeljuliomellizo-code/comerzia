/**
 * COMERZIA — Semilla de datos iniciales (multi-tenant)
 * Población completa: capa SaaS (planes, módulos, organizaciones demo,
 * facturas de suscripción, tickets) + datos operativos del negocio demo.
 *
 * Es idempotente: puede correr sobre una base ya poblada por los scripts
 * SQL de supabase/ o sobre una base vacía (npm run db:push + db:seed).
 *
 * Uso:  npm run db:seed
 */
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ── Contraseñas (mismo formato que src/lib/auth.ts) ─────────────────────────
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `s1$${salt}$${hash}`;
}

// Generador pseudoaleatorio determinista (mismos datos en cada semilla)
let seedState = 42;
function rnd(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(min + rnd() * (max - min + 1));
}

const YEAR = new Date().getFullYear();

// ════════════════════════════════════════════════════════════════════════════
// 1 · CAPA SaaS (idempotente)
// ════════════════════════════════════════════════════════════════════════════

const PLANS = [
  {
    code: "basico",
    name: "Básico",
    description: "Para pequeños comercios que están comenzando: ventas, productos, inventario de una bodega y facturación electrónica.",
    monthlyPrice: 89900,
    maxBranches: 1,
    maxWarehouses: 1,
    maxUsers: 3,
    maxProducts: 1000,
    maxCustomers: 1000,
    maxPos: 1,
    maxPriceLists: 2,
    storageGb: 2,
    apiAccess: "ninguno",
    sortOrder: 1,
  },
  {
    code: "profesional",
    name: "Profesional",
    description: "Para negocios en crecimiento: múltiples sucursales y bodegas, cotizaciones, mayoristas, marketing y reportes avanzados.",
    monthlyPrice: 149900,
    maxBranches: 5,
    maxWarehouses: 10,
    maxUsers: 15,
    maxProducts: 10000,
    maxCustomers: 10000,
    maxPos: 5,
    maxPriceLists: 5,
    storageGb: 10,
    apiAccess: "limitada",
    sortOrder: 2,
  },
  {
    code: "premium",
    name: "Premium",
    description: "Para distribuidores y empresas: tienda virtual, logística, inteligencia de negocios, automatizaciones y API completa.",
    monthlyPrice: 229900,
    maxBranches: null,
    maxWarehouses: null,
    maxUsers: null,
    maxProducts: null,
    maxCustomers: null,
    maxPos: null,
    maxPriceLists: null,
    storageGb: 50,
    apiAccess: "completa",
    sortOrder: 3,
  },
];

const PLATFORM_MODULES = [
  { code: "overview", name: "Resumen", description: "Indicadores y estadísticas del comercio", sortOrder: 1 },
  { code: "pos", name: "Punto de venta", description: "Ventas, carrito, cupones y cobros", sortOrder: 2 },
  { code: "cash", name: "Caja", description: "Apertura, arqueo y cierre de caja", sortOrder: 3 },
  { code: "sales", name: "Ventas", description: "Historial de ventas y anulaciones", sortOrder: 4 },
  { code: "quotations", name: "Cotizaciones y pedidos", description: "Cotizaciones convertibles a venta y pedidos", sortOrder: 5 },
  { code: "products", name: "Productos", description: "Catálogo, precios y clasificación", sortOrder: 6 },
  { code: "inventory", name: "Inventario", description: "Existencias, bodegas y movimientos", sortOrder: 7 },
  { code: "purchases", name: "Compras", description: "Órdenes de compra y recepción", sortOrder: 8 },
  { code: "suppliers", name: "Proveedores", description: "Gestión de proveedores y pagos", sortOrder: 9 },
  { code: "customers", name: "Clientes", description: "CRM, cartera y fidelización", sortOrder: 10 },
  { code: "marketing", name: "Marketing", description: "Cupones, promociones y campañas", sortOrder: 11 },
  { code: "finance", name: "Finanzas", description: "Ingresos, egresos, CxC y CxP", sortOrder: 12 },
  { code: "einvoice", name: "Facturación electrónica", description: "Documentos fiscales DIAN", sortOrder: 13 },
  { code: "reports", name: "Reportes", description: "Analítica, rentabilidad y exportación", sortOrder: 14 },
  { code: "users", name: "Usuarios", description: "Usuarios y roles del panel", sortOrder: 15 },
  { code: "settings", name: "Ajustes", description: "Configuración del comercio", sortOrder: 16 },
];

const PLATFORM_SETTINGS: Record<string, string> = {
  platform_name: "COMERZIA",
  support_email: "soporte@comerzia.com",
  default_trial_days: "15",
  grace_period_days: "5",
  tax_rate: "19",
  currency: "COP",
  session_days: "7",
  maintenance_mode: "false",
  allow_self_registration: "true",
  saas_invoice_prefix: "S",
  ticket_prefix: "T",
};

const DEMO_ORGS = [
  { slug: "comerzia-demo", name: "Comerzia Demo Store", taxId: "NIT 900.777.888-4", address: "Cra. 50 #12-34, Medellín", email: "demo@comerzia.com", status: "activa", plan: "profesional", subStatus: "activa", periodDays: 22, startedMonthsAgo: 8 },
  { slug: "el-faro", name: "Distribuidora El Faro", taxId: "NIT 901.101.202-3", address: "Av. El Poblado #45-80, Medellín", email: "contacto@elfaro.co", status: "prueba", plan: "basico", subStatus: "prueba", periodDays: null, startedMonthsAgo: 0 },
  { slug: "ferretera-la-construccion", name: "Ferretería La Construcción", taxId: "NIT 901.555.606-7", address: "Calle 80 #23-15, Bogotá", email: "ventas@laconstructoracion.co", status: "activa", plan: "premium", subStatus: "vencida", periodDays: -12, startedMonthsAgo: 14 },
  { slug: "papeleria-mundo-escolar", name: "Papelería Mundo Escolar", taxId: "NIT 901.331.445-9", address: "Cra. 7 #63-44, Bogotá", email: "admin@mundoeducar.co", status: "activa", plan: "profesional", subStatus: "activa", periodDays: 9, startedMonthsAgo: 6 },
  { slug: "jugueteria-suenos", name: "Juguetería Sueños", taxId: "NIT 901.222.333-1", address: "Cra. 43D #10-25, Medellín", email: "hola@jugueteriasuenos.co", status: "activa", plan: "basico", subStatus: "activa", periodDays: 18, startedMonthsAgo: 10 },
  { slug: "hogar-jardin", name: "Hogar & Jardín SAS", taxId: "NIT 900.111.222-5", address: "Av. 68 #40-10, Bogotá", email: "finanzas@hogaryjardin.co", status: "suspendida", plan: "basico", subStatus: "vencida", periodDays: -25, startedMonthsAgo: 16 },
];

const DEMO_OWNERS = [
  { slug: "el-faro", email: "elfaro@comerzia.com", name: "Camila Ríos" },
  { slug: "ferretera-la-construccion", email: "ferretera@comerzia.com", name: "Andrés Gómez" },
  { slug: "papeleria-mundo-escolar", email: "papeleria@comerzia.com", name: "Laura Martínez" },
  { slug: "jugueteria-suenos", email: "jugueteria@comerzia.com", name: "Julián Osorio" },
  { slug: "hogar-jardin", email: "hogarjardin@comerzia.com", name: "Valentina Peña" },
];

async function ensureSaasCore() {
  console.log("→ Planes comerciales…");
  for (const p of PLANS) {
    await db.plan.upsert({ where: { code: p.code }, update: { monthlyPrice: p.monthlyPrice }, create: p });
  }

  console.log("→ Catálogo de módulos…");
  for (const m of PLATFORM_MODULES) {
    await db.platformModule.upsert({ where: { code: m.code }, update: { name: m.name }, create: { ...m, isActive: true } });
  }

  console.log("→ Parámetros de la plataforma…");
  for (const [key, value] of Object.entries(PLATFORM_SETTINGS)) {
    await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log("→ Cupones comerciales de la plataforma…");
  const now = new Date();
  const platformCoupons = [
    { code: "BIENVENIDA20", discountType: "porcentaje", value: 20, maxRedemptions: 100, redemptions: 7, startsAt: new Date(now.getTime() - 30 * 86400000), endsAt: new Date(now.getTime() + 90 * 86400000), isActive: true, notes: "Descuento de bienvenida para nuevas organizaciones" },
    { code: "PRIMERMES50K", discountType: "monto", value: 50000, maxRedemptions: 50, redemptions: 3, startsAt: new Date(now.getTime() - 15 * 86400000), endsAt: new Date(now.getTime() + 45 * 86400000), isActive: true, notes: "$50.000 de descuento en el primer cobro" },
    { code: "REACTIVA10", discountType: "porcentaje", value: 10, maxRedemptions: null, redemptions: 0, startsAt: new Date(now.getTime() - 5 * 86400000), endsAt: new Date(now.getTime() + 60 * 86400000), isActive: true, notes: "Recuperación de organizaciones morosas" },
  ];
  for (const c of platformCoupons) {
    await db.platformCoupon.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  console.log("→ Integraciones de la plataforma…");
  const integrations = [
    { code: "wompi", name: "Wompi (pagos SaaS)", category: "pagos", isActive: true, config: { env: "produccion", webhook_url: "/api/integraciones/wompi" } },
    { code: "resend", name: "Resend (correo transaccional)", category: "notificaciones", isActive: true, config: { from: "no-reply@comerzia.com" } },
    { code: "whatsapp", name: "WhatsApp Business API", category: "mensajeria", isActive: false, config: { numero: "+57300XXXXXXX" } },
    { code: "dian", name: "Habilitación DIAN (consumo interno)", category: "fiscal", isActive: true, config: { ambiente: "habilitacion" } },
    { code: "storage", name: "Supabase Storage (respaldos)", category: "infraestructura", isActive: true, config: { bucket: "comerzia-backups" } },
  ];
  for (const it of integrations) {
    await db.platformIntegration.upsert({ where: { code: it.code }, update: { name: it.name }, create: it });
  }

  console.log("→ Usuarios base…");
  const superAdmin = await db.profile.upsert({
    where: { email: "super@comerzia.com" },
    update: { isSuperAdmin: true },
    create: {
      email: "super@comerzia.com",
      fullName: "Administrador COMERZIA",
      isSuperAdmin: true,
      passwordHash: hashPassword("admin123"),
    },
  });
  void superAdmin;
  await db.profile.upsert({
    where: { email: "demo@comerzia.com" },
    update: {},
    create: { email: "demo@comerzia.com", fullName: "Propietario Demo", passwordHash: hashPassword("demo123") },
  });
  await db.profile.upsert({
    where: { email: "cajero@comerzia.com" },
    update: {},
    create: { email: "cajero@comerzia.com", fullName: "Cajero Demo", passwordHash: hashPassword("cajero123") },
  });
}

async function ensureDemoOrganizations(): Promise<Record<string, string>> {
  console.log("→ Organizaciones de demostración…");
  const orgIds: Record<string, string> = {};

  for (const o of DEMO_ORGS) {
    const existing = await db.organization.findUnique({ where: { slug: o.slug } });
    if (existing) {
      orgIds[o.slug] = existing.id;
      continue;
    }
    const org = await db.organization.create({
      data: {
        name: o.name,
        slug: o.slug,
        taxId: o.taxId,
        address: o.address,
        email: o.email,
        status: o.status,
        suspendedAt: o.status === "suspendida" ? new Date(Date.now() - 6 * 86400000) : null,
        trialEndsAt: o.slug === "el-faro" ? new Date(Date.now() + 12 * 86400000) : null,
      },
    });
    orgIds[o.slug] = org.id;
  }

  const plans = await db.plan.findMany();
  const planByCode = new Map(plans.map((p) => [p.code, p]));
  const modules = await db.platformModule.findMany({ where: { isActive: true } });

  for (const o of DEMO_ORGS) {
    const orgId = orgIds[o.slug];
    const plan = planByCode.get(o.plan)!;

    await db.subscription.upsert({
      where: { organizationId: orgId },
      update: {},
      create: {
        organizationId: orgId,
        planId: plan.id,
        status: o.subStatus,
        startedAt: new Date(Date.now() - o.startedMonthsAgo * 30 * 86400000),
        currentPeriodEnd: o.periodDays === null ? null : new Date(Date.now() + o.periodDays * 86400000),
        cancelAtPeriodEnd: o.slug === "jugueteria-suenos",
      },
    });

    await db.organizationSetting.upsert({
      where: { organizationId: orgId },
      update: {},
      create: { organizationId: orgId, storeName: o.name, taxId: o.taxId, address: o.address, taxRate: 19 },
    });

    for (const m of modules) {
      await db.organizationModule.upsert({
        where: { organizationId_moduleId: { organizationId: orgId, moduleId: m.id } },
        update: {},
        create: { organizationId: orgId, moduleId: m.id, enabled: true },
      });
    }

    // Propietarios de las organizaciones de demostración
    if (o.slug === "comerzia-demo") {
      const owner = await db.profile.findUnique({ where: { email: "demo@comerzia.com" } });
      const cajero = await db.profile.findUnique({ where: { email: "cajero@comerzia.com" } });
      if (owner) {
        await db.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: orgId, userId: owner.id } },
          update: {},
          create: { organizationId: orgId, userId: owner.id, role: "OWNER" },
        });
      }
      if (cajero) {
        await db.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: orgId, userId: cajero.id } },
          update: {},
          create: { organizationId: orgId, userId: cajero.id, role: "CAJERO" },
        });
      }
    } else {
      const ownerInfo = DEMO_OWNERS.find((d) => d.slug === o.slug)!;
      let owner = await db.profile.findUnique({ where: { email: ownerInfo.email } });
      if (!owner) {
        owner = await db.profile.create({
          data: { email: ownerInfo.email, fullName: ownerInfo.name, passwordHash: hashPassword("demo123") },
        });
      }
      await db.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: orgId, userId: owner.id } },
        update: {},
        create: { organizationId: orgId, userId: owner.id, role: "OWNER" },
      });
    }
  }

  return orgIds;
}

async function ensureSaasDemoData(orgIds: Record<string, string>) {
  // Solo si la base no tiene facturas del SaaS (es decir, no se ejecutó el SQL 04)
  const existingInvoices = await db.saasInvoice.count();
  if (existingInvoices > 0) {
    console.log("→ Facturas SaaS ya presentes (sembradas por SQL); se omiten.");
    return;
  }

  console.log("→ Facturas, pagos y renovaciones del SaaS…");
  let invoiceSeq = 1;
  const now = new Date();
  const withInvoices = ["comerzia-demo", "ferretera-la-construccion", "papeleria-mundo-escolar", "jugueteria-suenos", "hogar-jardin"];

  for (const slug of withInvoices) {
    const orgId = orgIds[slug];
    const sub = await db.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } });
    if (!sub) continue;

    for (let i = 6; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const dueAt = new Date(monthStart.getTime() + 5 * 86400000);

      const isCurrent = i === 0;
      const isOverdue =
        (slug === "ferretera-la-construccion" && i <= 2) || (slug === "hogar-jardin" && i <= 2);
      if (isCurrent && slug === "hogar-jardin") continue; // suspendida no factura el mes actual

      const amount = sub.plan.monthlyPrice;
      const taxAmount = Math.round(amount * 0.19 * 100) / 100;
      const total = Math.round(amount * 1.19 * 100) / 100;

      const invoice = await db.saasInvoice.create({
        data: {
          number: `S-${YEAR}-${String(invoiceSeq++).padStart(5, "0")}`,
          organizationId: orgId,
          subscriptionId: sub.id,
          periodStart: monthStart,
          periodEnd: monthEnd,
          amount,
          taxRate: 19,
          taxAmount,
          total,
          status: isCurrent ? "pendiente" : isOverdue ? "vencida" : "pagada",
          issuedAt: monthStart,
          dueAt,
          paidAt: !isCurrent && !isOverdue ? new Date(monthStart.getTime() + 2 * 86400000) : null,
        },
      });

      if (invoice.status === "pagada") {
        await db.saasPayment.create({
          data: {
            organizationId: orgId,
            invoiceId: invoice.id,
            amount: total,
            method: invoiceSeq % 3 === 0 ? "pse" : "transferencia",
            reference: `TRX-${invoice.number}`,
            status: "confirmado",
            receivedAt: invoice.paidAt!,
          },
        });
      }
    }

    // Historial de renovaciones (3 meses)
    for (let i = 3; i >= 1; i--) {
      await db.saasRenewal.create({
        data: {
          organizationId: orgId,
          subscriptionId: sub.id,
          previousPeriodEnd: new Date(now.getTime() - i * 30 * 86400000),
          newPeriodEnd: new Date(now.getTime() - (i - 1) * 30 * 86400000),
        },
      });
    }
  }

  console.log("→ Cancelación programada de demostración…");
  const jugueteriaSub = await db.subscription.findUnique({ where: { organizationId: orgIds["jugueteria-suenos"] } });
  if (jugueteriaSub) {
    await db.saasCancellation.create({
      data: {
        organizationId: orgIds["jugueteria-suenos"],
        subscriptionId: jugueteriaSub.id,
        type: "fin_periodo",
        reason: "Baja voluntaria: cierran la tienda física en agosto",
        status: "programada",
        effectiveAt: jugueteriaSub.currentPeriodEnd,
      },
    });
  }

  console.log("→ Tickets de soporte de demostración…");
  let ticketSeq = 1;
  const tickets = [
    { org: "comerzia-demo", subject: "Error al emitir factura electrónica", description: "Al intentar emitir la factura F-2026-00042 la DIAN devuelve rechazo por validación del NIT.", status: "abierto", priority: "urgente", category: "facturacion", hoursAgo: 2 },
    { org: "papeleria-mundo-escolar", subject: "Duda con reporte de rotación", description: "¿Cómo calcula COMERZIA la rotación de inventario en el reporte avanzado?", status: "pendiente", priority: "baja", category: "reportes", hoursAgo: 24 },
    { org: "ferretera-la-construccion", subject: "Cobro duplicado en septiembre", description: "Aparecen dos cobros por $273.581 en septiembre. Solicito reversión del segundo.", status: "abierto", priority: "alta", category: "facturacion", hoursAgo: 72 },
    { org: "el-faro", subject: "Capacitación POS para bodega", description: "Queremos agendar una sesión de capacitación del POS para el equipo de bodega.", status: "pendiente", priority: "media", category: "capacitacion", hoursAgo: 120 },
    { org: "jugueteria-suenos", subject: "Cambiar método de pago", description: "Queremos pasar la suscripción de transferencia a PSE.", status: "cerrado", priority: "media", category: "suscripciones", hoursAgo: 480 },
  ];
  for (const t of tickets) {
    const ticket = await db.supportTicket.create({
      data: {
        number: `T-${YEAR}-${String(ticketSeq++).padStart(5, "0")}`,
        organizationId: orgIds[t.org],
        subject: t.subject,
        description: t.description,
        status: t.status,
        priority: t.priority,
        category: t.category,
        createdBy: "panel del negocio",
        createdAt: new Date(now.getTime() - t.hoursAgo * 3600000),
        updatedAt: new Date(now.getTime() - t.hoursAgo * 3600000),
        closedAt: t.status === "cerrado" ? new Date(now.getTime() - (t.hoursAgo - 24) * 3600000) : null,
      },
    });
    await db.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorName: "propietario del negocio",
        authorRole: "organizacion",
        body: t.description,
        createdAt: ticket.createdAt,
      },
    });
    if (t.status !== "abierto") {
      await db.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorName: "Soporte COMERZIA",
          authorRole: "soporte",
          body: "Gracias por escribir. Estamos revisando tu caso y te respondemos en breve.",
          createdAt: new Date(ticket.createdAt.getTime() + 4 * 3600000),
        },
      });
    }
  }

  console.log("→ Notificaciones e integraciones (logs)…");
  await db.platformNotification.create({
    data: { title: "Mantenimiento programado", body: "El próximo domingo entre 1:00 y 3:00 a.m. la plataforma tendrá mantenimiento.", audience: "todas", channel: "in_app", status: "enviada", sentAt: new Date(now.getTime() - 4 * 86400000), createdBy: "super@comerzia.com" },
  });
  await db.platformNotification.create({
    data: { title: "Pago rechazado — actualiza tu método de pago", body: "Tu suscripción quedó vencida. Actualiza el método de pago para reactivar tu cuenta.", audience: "organizacion", organizationId: orgIds["ferretera-la-construccion"], channel: "email", status: "enviada", sentAt: new Date(now.getTime() - 6 * 86400000), createdBy: "super@comerzia.com" },
  });

  const wompi = await db.platformIntegration.findUnique({ where: { code: "wompi" } });
  if (wompi) {
    await db.platformIntegrationLog.createMany({
      data: [
        { integrationId: wompi.id, level: "error", message: "Webhook de cobro rechazado: firma inválida (org. Ferretería La Construcción)", detail: { invoice: "S-2026-00048", code: "invalid_signature" }, createdAt: new Date(now.getTime() - 26 * 3600000) },
        { integrationId: wompi.id, level: "error", message: "Reintento de cobro fallido: fondos insuficientes (org. Hogar & Jardín SAS)", detail: { invoice: "S-2026-00052", code: "insufficient_funds" }, createdAt: new Date(now.getTime() - 8 * 3600000) },
        { integrationId: wompi.id, level: "info", message: "Cobro recurrente procesado correctamente para 12 organizaciones", createdAt: new Date(now.getTime() - 5 * 3600000) },
      ],
    });
    await db.platformIntegration.update({
      where: { id: wompi.id },
      data: { lastErrorAt: new Date(now.getTime() - 8 * 3600000), lastErrorMessage: "Reintento de cobro fallido: fondos insuficientes (org. Hogar & Jardín SAS)" },
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 2 · DATOS OPERATIVOS DEL NEGOCIO DEMO
// ════════════════════════════════════════════════════════════════════════════

const PRODUCTS = [
  // Bebidas
  { name: "Café premium molido 500g", sku: "BEB-001", category: "Bebidas", cost: 12000, price: 22000, stock: 48, min: 12, desc: "Café arábiga tostado medio, origen Nariño." },
  { name: "Chocolate caliente en polvo 400g", sku: "BEB-002", category: "Bebidas", cost: 6500, price: 12500, stock: 30, min: 10, desc: "Cacao con leche, sabor clásico." },
  { name: "Té verde caja 25 bolsas", sku: "BEB-003", category: "Bebidas", cost: 7000, price: 13500, stock: 8, min: 10, desc: "Té verde natural, caja familiar." },
  { name: "Agua sin gas botella 600ml", sku: "BEB-004", category: "Bebidas", cost: 900, price: 2500, stock: 120, min: 24, desc: "Hidratación pura, botella retornable." },
  { name: "Gaseosa personal 400ml", sku: "BEB-005", category: "Bebidas", cost: 1500, price: 3200, stock: 96, min: 24, desc: "Sabor original, presentación personal." },
  { name: "Jugo natural mango 1L", sku: "BEB-006", category: "Bebidas", cost: 4800, price: 9500, stock: 15, min: 8, desc: "Pulpa de mango sin azúcar añadida." },
  // Abarrotes
  { name: "Arroz blanco 5kg", sku: "ABA-001", category: "Abarrotes", cost: 14000, price: 23500, stock: 40, min: 10, desc: "Arroz de grano largo, calidad extra." },
  { name: "Aceite vegetal 3L", sku: "ABA-002", category: "Abarrotes", cost: 16500, price: 27900, stock: 22, min: 8, desc: "Ideal para freír y cocinar." },
  { name: "Panela redonda 1kg", sku: "ABA-003", category: "Abarrotes", cost: 5500, price: 9900, stock: 35, min: 10, desc: "Panela orgánica de caña pura." },
  { name: "Lentejas 1kg", sku: "ABA-004", category: "Abarrotes", cost: 5200, price: 8900, stock: 26, min: 8, desc: "Ricas en proteína y fibra." },
  { name: "Pasta espagueti 500g", sku: "ABA-005", category: "Abarrotes", cost: 2600, price: 4900, stock: 60, min: 15, desc: "Sémola de trigo 100%." },
  { name: "Sal marina 500g", sku: "ABA-006", category: "Abarrotes", cost: 1500, price: 3200, stock: 4, min: 10, desc: "Sal refinada y yodada." },
  // Panadería
  { name: "Pan artesanal campesino", sku: "PAN-001", category: "Panadería", cost: 2200, price: 4800, stock: 18, min: 6, desc: "Horneado a la leña cada mañana." },
  { name: "Croissant de mantequilla", sku: "PAN-002", category: "Panadería", cost: 1800, price: 4200, stock: 24, min: 8, desc: "Hojaldre francés recién horneado." },
  { name: "Torta de zanahoria porción", sku: "PAN-003", category: "Panadería", cost: 2600, price: 6500, stock: 10, min: 5, desc: "Con betún de queso crema." },
  { name: "Galletas de avena pack x6", sku: "PAN-004", category: "Panadería", cost: 3200, price: 7200, stock: 2, min: 8, desc: "Crocanteres, sin conservantes." },
  // Aseo
  { name: "Jabón rey 1kg", sku: "ASE-001", category: "Aseo", cost: 4300, price: 7900, stock: 28, min: 10, desc: "Multiusos para lavandería." },
  { name: "Detergente en polvo 2kg", sku: "ASE-002", category: "Aseo", cost: 11000, price: 18900, stock: 16, min: 6, desc: "Con quitagrasas potenciado." },
  { name: "Papel higiénico x10 rollos", sku: "ASE-003", category: "Aseo", cost: 9800, price: 16500, stock: 34, min: 12, desc: "Doble hoja, ultra suave." },
  { name: "Limpiador multiusos 1L", sku: "ASE-004", category: "Aseo", cost: 4100, price: 7600, stock: 9, min: 8, desc: "Aroma cítrico, alto rendimiento." },
  // Hogar
  { name: "Set de vasos vidrio x6", sku: "HOG-001", category: "Hogar", cost: 15000, price: 26900, stock: 12, min: 4, desc: "Vidrio templado, 260ml." },
  { name: "Cuchillo multiuso acero", sku: "HOG-002", category: "Hogar", cost: 8500, price: 15900, stock: 7, min: 4, desc: "Filo de acero inoxidable." },
  { name: "Tabla de picar bamboo", sku: "HOG-003", category: "Hogar", cost: 11000, price: 19900, stock: 5, min: 3, desc: "Bambú ecológico 30x20cm." },
  { name: "Funda para celular universal", sku: "HOG-004", category: "Hogar", cost: 6000, price: 15000, stock: 21, min: 6, desc: "Silicona reforzada, varios tonos." },
];

const CUSTOMERS = [
  { name: "María Fernanda Gómez", email: "mf.gomez@correo.com", phone: "310 555 0132", type: "particular", docId: "CC 1.098.442.113", address: "Cra. 45 #23-18, Medellín" },
  { name: "Restaurante La Esquina", email: "pedidos@laesquina.co", phone: "604 442 8190", type: "empresa", docId: "NIT 900.123.456-7", address: "Calle 10 #5-32, Medellín" },
  { name: "Carlos Andrés Rojas", email: "carosroj@gmail.com", phone: "312 118 7645", type: "particular", docId: "CC 79.654.221", address: "Calle 80 #34-09, Bogotá" },
  { name: "Cafetería Dulce Aroma", email: "hola@dulcearoma.co", phone: "601 315 2277", type: "empresa", docId: "NIT 901.456.789-2", address: "Cra. 7 #63-44, Bogotá" },
  { name: "Luisa Marcela Torres", email: "luisa.torres@correo.com", phone: "320 876 4512", type: "particular", docId: "CC 1.032.884.907", address: "Av. 5 #12-03, Cali" },
  { name: "Tienda Barrio Obrero", email: "barrioobrero@tiendas.co", phone: "602 228 3344", type: "empresa", docId: "NIT 900.777.111-9", address: "Cra. 15 #8-77, Cali" },
  { name: "Jorge Iván Pérez", email: "jiperez@correo.com", phone: "313 209 5518", type: "particular", docId: "CC 98.112.334", address: "Calle 30 #8-5, Bucaramanga" },
  { name: "Panadería El Trigal", email: "compras@eltrigal.co", phone: "607 685 1120", type: "empresa", docId: "NIT 901.222.333-4", address: "Cra. 27 #45-60, Bucaramanga" },
  { name: "Ana Sofía Murillo", email: "asomurillo@correo.com", phone: "314 667 8890", type: "particular", docId: "CC 1.155.990.224", address: "Cra. 51 #52-1, Medellín" },
  { name: "Oficina Central Nova Ltda.", email: "nova@novaltda.com", phone: "605 122 9080", type: "empresa", docId: "NIT 800.555.999-1", address: "Cra. 43 #14-22, Barranquilla" },
  { name: "Diego Alejandro Ruiz", email: "daruiz@correo.com", phone: "318 902 4415", type: "particular", docId: "CC 80.445.123", address: "Calle 14 #3-88, Pereira" },
  { name: "Comercializadora del Sur", email: "ventas@cdelsur.co", phone: "608 535 7711", type: "empresa", docId: "NIT 902.888.444-6", address: "Av. Circunvalar #2-15, Pasto" },
];

const PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia"];
const SALE_NOTES = [
  "Cliente frecuente, aplica fidelización.",
  "Pedido para evento de oficina.",
  "Entrega a domicilio acordada.",
  "Compra de reposición semanal.",
  "Facturación a nombre de la empresa.",
];

async function seedBusinessData(orgId: string) {
  console.log("→ Limpiando datos operativos previos de la organización demo…");
  await db.financeTransaction.deleteMany({ where: { organizationId: orgId } });
  await db.cashMovement.deleteMany({ where: { organizationId: orgId } });
  const cashSessions = await db.cashSession.findMany({ where: { organizationId: orgId }, select: { id: true } });
  if (cashSessions.length) {
    await db.cashSession.deleteMany({ where: { id: { in: cashSessions.map((s) => s.id) } } });
  }
  await db.movement.deleteMany({ where: { organizationId: orgId } });
  const sales = await db.sale.findMany({ where: { organizationId: orgId }, select: { id: true } });
  await db.saleItem.deleteMany({ where: { saleId: { in: sales.map((s) => s.id) } } });
  await db.sale.deleteMany({ where: { organizationId: orgId } });
  const purchases = await db.purchase.findMany({ where: { organizationId: orgId }, select: { id: true } });
  await db.purchaseItem.deleteMany({ where: { purchaseId: { in: purchases.map((p) => p.id) } } });
  await db.purchase.deleteMany({ where: { organizationId: orgId } });
  const quotations = await db.quotation.findMany({ where: { organizationId: orgId }, select: { id: true } });
  await db.quotationItem.deleteMany({ where: { quotationId: { in: quotations.map((q) => q.id) } } });
  await db.quotation.deleteMany({ where: { organizationId: orgId } });
  await db.coupon.deleteMany({ where: { organizationId: orgId } });
  await db.customer.deleteMany({ where: { organizationId: orgId } });
  await db.product.deleteMany({ where: { organizationId: orgId } });
  await db.supplier.deleteMany({ where: { organizationId: orgId } });

  console.log("→ Configuración del comercio…");
  await db.organizationSetting.upsert({
    where: { organizationId: orgId },
    update: { storeName: "Comerzia Demo Store", taxId: "NIT 900.777.888-4", address: "Cra. 50 #12-34, Medellín", currency: "COP", taxRate: 19, lowStockWarn: true },
    create: { organizationId: orgId, storeName: "Comerzia Demo Store", taxId: "NIT 900.777.888-4", address: "Cra. 50 #12-34, Medellín", currency: "COP", taxRate: 19, lowStockWarn: true },
  });

  console.log("→ Productos…");
  const BRAND_BY_CAT: Record<string, string> = {
    Bebidas: "Nariño Gold",
    Abarrotes: "Doña Isabel",
    Panadería: "La Espiga",
    Aseo: "Aseo Global",
    Hogar: "HogarPlus",
  };
  const UNIT_BY_SKU: Record<string, string> = {
    "BEB-001": "paquete",
    "BEB-003": "caja",
    "ABA-001": "bulto",
    "ASE-002": "caja",
    "PAN-001": "bulto",
  };
  const products: Awaited<ReturnType<typeof db.product.create>>[] = [];
  let pIdx = 0;
  for (const p of PRODUCTS) {
    pIdx++;
    products.push(
      await db.product.create({
        data: {
          organizationId: orgId,
          name: p.name,
          sku: p.sku,
          barcode: `7701234${String(100000 + pIdx)}`,
          brand: BRAND_BY_CAT[p.category] ?? "Genérico",
          unit: UNIT_BY_SKU[p.sku] ?? "unidad",
          category: p.category,
          description: p.desc,
          costPrice: p.cost,
          salePrice: p.price,
          wholesalePrice: Math.round(p.price * 0.9),
          stock: p.stock,
          minStock: p.min,
          active: true,
        },
      })
    );
  }

  console.log("→ Clientes…");
  const customers: Awaited<ReturnType<typeof db.customer.create>>[] = [];
  for (const c of CUSTOMERS) {
    customers.push(await db.customer.create({ data: { ...c, organizationId: orgId } }));
  }

  console.log("→ Ventas de los últimos 45 días…");
  const now = new Date();
  const creditSales: Array<{ id: string; folio: string; total: number; customerName: string }> = [];
  let folioN = (await db.sale.count({ where: { organizationId: orgId } })) + 1;
  let salesCreated = 0;

  for (let day = 44; day >= 0; day--) {
    const d = new Date(now);
    d.setDate(d.getDate() - day);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const nSales = randInt(isWeekend ? 3 : 1, isWeekend ? 6 : 4);

    for (let s = 0; s < nSales; s++) {
      const nItems = randInt(1, 4);
      const items: Array<{
        organizationId: string;
        productId: string;
        name: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];
      const used = new Set<string>();
      for (let i = 0; i < nItems; i++) {
        const prod = pick(products);
        if (used.has(prod.id)) continue;
        used.add(prod.id);
        const qty = randInt(1, 5);
        items.push({
          organizationId: orgId,
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          quantity: qty,
          unitPrice: prod.salePrice,
          subtotal: qty * prod.salePrice,
        });
      }
      const subtotal = items.reduce((a, it) => a + it.subtotal, 0);
      const discount = rnd() < 0.15 ? Math.round(subtotal * 0.05) : 0;
      const tax = Math.round((subtotal - discount) * 0.19);
      const total = subtotal - discount + tax;

      const withCustomer = rnd() < 0.6;
      const customer = withCustomer ? pick(customers) : null;
      const hour = randInt(8, 19);
      const createdAt = new Date(d);
      createdAt.setHours(hour, randInt(0, 59), 0, 0);
      if (createdAt > now) continue;

      const status = rnd() < 0.93 ? "completada" : "pendiente";
      const onCredit = status === "completada" && customer?.type === "empresa" && rnd() < 0.25;

      const sale = await db.sale.create({
        data: {
          organizationId: orgId,
          folio: `F-${YEAR}-${String(folioN++).padStart(5, "0")}`,
          customerId: customer?.id ?? null,
          customerName: customer ? customer.name : "Cliente de mostrador",
          subtotal,
          discount,
          tax,
          total,
          paymentMethod: onCredit ? "credito" : pick(PAYMENT_METHODS),
          status,
          note: rnd() < 0.25 ? pick(SALE_NOTES) : null,
          createdAt,
          items: { create: items },
        },
      });
      if (onCredit) creditSales.push(sale);
      salesCreated++;
    }
  }

  console.log("→ Proveedores…");
  const SUPPLIERS = [
    { name: "Distribuidora Andina S.A.S.", taxId: "NIT 800.111.222-3", contactName: "Camila Restrepo", email: "ventas@andina.co", phone: "604 512 8890", address: "Zona Industrial, Medellín", paymentTerms: "credito_30", notes: "Abarrotes y bebidas al por mayor." },
    { name: "Abarrotes del Valle Ltda.", taxId: "NIT 900.222.333-4", contactName: "Julián Cárdenas", email: "pedidos@valle.com", phone: "602 330 1177", address: "Cali, Valle del Cauca", paymentTerms: "credito_15", notes: "Entregas los martes y viernes." },
    { name: "Panificadora La Espiga", taxId: "NIT 901.333.444-5", contactName: "Rosa Martínez", email: "hola@laespiga.co", phone: "604 285 4433", address: "Envigado, Antioquia", paymentTerms: "contado", notes: "Pan fresco diario." },
    { name: "Aseo Global S.A.", taxId: "NIT 902.444.555-6", contactName: "Andrés Vélez", email: "comercial@aseoglobal.com", phone: "601 745 9900", address: "Bogotá D.C.", paymentTerms: "credito_30", notes: "Catálogo completo de aseo." },
    { name: "Hogar y Más Importaciones", taxId: "NIT 903.555.666-7", contactName: "Diana Ospina", email: "importaciones@hogarmas.co", phone: "604 612 3355", address: "Rionegro, Antioquia", paymentTerms: "credito_15", notes: "Mercancía de importación." },
    { name: "Bebidas del Caribe S.A.S.", taxId: "NIT 904.666.777-8", contactName: "Luis Mendoza", email: "ventas@bebascaribe.com", phone: "605 344 8811", address: "Barranquilla, Atlántico", paymentTerms: "contado", notes: "Bebidas frías al mayoreo." },
  ];
  const suppliers: Awaited<ReturnType<typeof db.supplier.create>>[] = [];
  for (const s of SUPPLIERS) {
    suppliers.push(await db.supplier.create({ data: { ...s, organizationId: orgId } }));
  }

  console.log("→ Órdenes de compra…");
  const PURCHASE_PLAN: Array<{ day: number; status: string; paid: boolean; nItems: number }> = [
    { day: 38, status: "recibida", paid: true, nItems: 3 },
    { day: 34, status: "recibida", paid: true, nItems: 2 },
    { day: 30, status: "recibida", paid: true, nItems: 4 },
    { day: 26, status: "recibida", paid: true, nItems: 2 },
    { day: 21, status: "recibida", paid: true, nItems: 3 },
    { day: 17, status: "recibida", paid: true, nItems: 2 },
    { day: 12, status: "recibida", paid: false, nItems: 3 },
    { day: 8, status: "recibida", paid: false, nItems: 2 },
    { day: 4, status: "pendiente", paid: false, nItems: 3 },
    { day: 2, status: "cancelada", paid: false, nItems: 1 },
  ];
  let purchaseFolio = (await db.purchase.count({ where: { organizationId: orgId } })) + 1;
  for (const plan of PURCHASE_PLAN) {
    const sup = pick(suppliers);
    const createdAt = new Date(now.getTime() - plan.day * 86400000);
    createdAt.setHours(randInt(8, 16), randInt(0, 59), 0, 0);
    const items: Array<{ productId: string; name: string; sku: string; quantity: number; unitCost: number; subtotal: number }> = [];
    const used = new Set<string>();
    for (let i = 0; i < plan.nItems; i++) {
      const prod = pick(products);
      if (used.has(prod.id)) continue;
      used.add(prod.id);
      const qty = randInt(10, 40);
      const unitCost = Math.round(prod.costPrice * (0.92 + rnd() * 0.08));
      items.push({ productId: prod.id, name: prod.name, sku: prod.sku, quantity: qty, unitCost, subtotal: qty * unitCost });
    }
    const subtotal = items.reduce((a, it) => a + it.subtotal, 0);
    const tax = Math.round(subtotal * 0.19);
    await db.purchase.create({
      data: {
        organizationId: orgId,
        folio: `C-${YEAR}-${String(purchaseFolio++).padStart(5, "0")}`,
        supplierId: sup.id,
        supplierName: sup.name,
        status: plan.status,
        subtotal,
        tax,
        total: subtotal + tax,
        paid: plan.paid,
        receivedAt: plan.status === "recibida" ? new Date(createdAt.getTime() + 2 * 86400000) : null,
        note: plan.status === "cancelada" ? "Anulada: proveedor sin inventario disponible." : null,
        createdAt,
        items: { create: items },
      },
    });
  }

  console.log("→ Cotizaciones…");
  const QUOTATION_PLAN: Array<{ day: number; status: string; validDays: number }> = [
    { day: 25, status: "convertida", validDays: 15 },
    { day: 19, status: "convertida", validDays: 15 },
    { day: 6, status: "aprobada", validDays: 20 },
    { day: 3, status: "enviada", validDays: 15 },
    { day: 1, status: "borrador", validDays: 30 },
  ];
  let quotationFolio = (await db.quotation.count({ where: { organizationId: orgId } })) + 1;
  for (const plan of QUOTATION_PLAN) {
    const customer = pick(customers.filter((c) => c.type === "empresa"));
    const createdAt = new Date(now.getTime() - plan.day * 86400000);
    createdAt.setHours(randInt(9, 17), randInt(0, 59), 0, 0);
    const nItems = randInt(2, 4);
    const items: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number; subtotal: number }> = [];
    const used = new Set<string>();
    for (let i = 0; i < nItems; i++) {
      const prod = pick(products);
      if (used.has(prod.id)) continue;
      used.add(prod.id);
      const qty = randInt(6, 30);
      const unitPrice = prod.wholesalePrice ?? Math.round(prod.salePrice * 0.9);
      items.push({ productId: prod.id, name: prod.name, sku: prod.sku, quantity: qty, unitPrice, subtotal: qty * unitPrice });
    }
    const subtotal = items.reduce((a, it) => a + it.subtotal, 0);
    const discount = rnd() < 0.4 ? Math.round(subtotal * 0.03) : 0;
    const tax = Math.round((subtotal - discount) * 0.19);
    const validUntil = new Date(createdAt.getTime() + plan.validDays * 86400000);
    await db.quotation.create({
      data: {
        organizationId: orgId,
        folio: `COT-${YEAR}-${String(quotationFolio++).padStart(4, "0")}`,
        customerId: customer.id,
        customerName: customer.name,
        status: plan.status,
        validUntil,
        subtotal,
        discount,
        tax,
        total: subtotal - discount + tax,
        note: "Precios por volumen. Vigencia sujeta a disponibilidad.",
        createdAt,
        items: { create: items },
      },
    });
  }

  console.log("→ Cupones de marketing…");
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in60 = new Date(now.getTime() + 60 * 86400000);
  const past = new Date(now.getTime() - 20 * 86400000);
  await db.coupon.createMany({
    data: [
      { organizationId: orgId, code: "BIENVENIDA10", type: "porcentaje", value: 10, minTotal: 30000, expiresAt: in30, usageCount: 7 },
      { organizationId: orgId, code: "MAYOR15", type: "porcentaje", value: 15, minTotal: 100000, expiresAt: in60, usageCount: 3 },
      { organizationId: orgId, code: "ENVIO5", type: "monto", value: 5000, minTotal: 20000, expiresAt: null, usageCount: 12 },
      { organizationId: orgId, code: "SANVALENTIN", type: "porcentaje", value: 20, minTotal: 50000, expiresAt: past, usageCount: 21 },
    ],
  });

  console.log("→ Sesión de caja cerrada (ayer)…");
  const yesterday = new Date(now.getTime() - 86400000);
  const opened = new Date(yesterday);
  opened.setHours(8, 0, 0, 0);
  const closedAt = new Date(yesterday);
  closedAt.setHours(20, 30, 0, 0);
  await db.cashSession.create({
    data: {
      organizationId: orgId,
      openedAt: opened,
      closedAt: closedAt,
      openingAmount: 300000,
      closingAmount: 493800,
      expectedAmount: 498800,
      difference: -5000,
      status: "cerrada",
      openedByName: "Sara Milena Ortiz",
      notes: "Faltante de $5.000. Se revisa el video del turno.",
      movements: {
        create: [
          { organizationId: orgId, type: "ingreso", amount: 89500, concept: `Venta F-${YEAR}-00133`, source: "venta", createdAt: new Date(opened.getTime() + 3600000 * 2) },
          { organizationId: orgId, type: "ingreso", amount: 154300, concept: `Venta F-${YEAR}-00136`, source: "venta", createdAt: new Date(opened.getTime() + 3600000 * 5) },
          { organizationId: orgId, type: "egreso", amount: 45000, concept: "Compra de insumos de aseo", source: "manual", createdAt: new Date(opened.getTime() + 3600000 * 7) },
        ],
      },
    },
  });

  console.log("→ Transacciones financieras…");
  const FINANCE = [
    { type: "egreso", category: "operativo", amount: 2500000, method: "transferencia", description: "Arriendo de la bodega", daysAgo: 10 },
    { type: "egreso", category: "operativo", amount: 480000, method: "transferencia", description: "Servicios públicos", daysAgo: 9 },
    { type: "egreso", category: "operativo", amount: 1200000, method: "efectivo", description: "Nómina quincenal", daysAgo: 7 },
    { type: "egreso", category: "operativo", amount: 320000, method: "efectivo", description: "Transporte y domicilios", daysAgo: 5 },
    { type: "ingreso", category: "otro", amount: 900000, method: "transferencia", description: "Renta subarriendo de local", daysAgo: 6 },
    { type: "ingreso", category: "otro", amount: 150000, method: "efectivo", description: "Bonificación de proveedor", daysAgo: 3 },
  ];
  for (const f of FINANCE) {
    const d = new Date(now.getTime() - f.daysAgo * 86400000);
    d.setHours(randInt(8, 18), randInt(0, 59), 0, 0);
    await db.financeTransaction.create({ data: { organizationId: orgId, type: f.type, category: f.category, amount: f.amount, method: f.method, description: f.description, createdAt: d } });
  }
  const topCredit = [...creditSales].sort((a, b) => b.total - a.total).slice(0, 2);
  for (const s of topCredit) {
    await db.financeTransaction.create({
      data: {
        organizationId: orgId,
        type: "ingreso",
        category: "abono_cliente",
        amount: Math.round(s.total * 0.4),
        method: "transferencia",
        description: `Abono venta ${s.folio} — ${s.customerName}`,
        refType: "sale",
        refId: s.id,
        createdAt: new Date(now.getTime() - randInt(1, 5) * 86400000),
      },
    });
  }

  console.log("→ Usuarios del panel del negocio demo…");
  const STAFF = [
    { name: "Ana María Restrepo", email: "admin@comerzia.co", role: "ADMIN" },
    { name: "Sara Milena Ortiz", email: "cajero1@comerzia.co", role: "CAJERO" },
    { name: "Juan Camilo Naranjo", email: "cajero2@comerzia.co", role: "CAJERO" },
    { name: "Laura Jiménez", email: "vendedor1@comerzia.co", role: "VENDEDOR" },
    { name: "Kevin Duarte", email: "inventario@comerzia.co", role: "INVENTARIO" },
    { name: "Valentina Quintero", email: "compras@comerzia.co", role: "COMPRAS" },
    { name: "Óscar Ibáñez", email: "contador@comerzia.co", role: "CONTADOR" },
    { name: "Mónica Arboleda", email: "logistica@comerzia.co", role: "LOGISTICA" },
    { name: "Fernando Rincón", email: "auditor@comerzia.co", role: "AUDITOR" },
  ];
  for (const u of STAFF) {
    const profile = await db.profile.upsert({
      where: { email: u.email },
      update: { fullName: u.name },
      create: { email: u.email, fullName: u.name, passwordHash: hashPassword("demo123"), lastLoginAt: new Date(now.getTime() - randInt(0, 48) * 3600000) },
    });
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: profile.id } },
      update: { role: u.role, active: true },
      create: { organizationId: orgId, userId: profile.id, role: u.role, active: true },
    });
  }

  console.log("→ Movimientos de inventario recientes…");
  for (let i = 0; i < 18; i++) {
    const prod = pick(products);
    const type = pick(["entrada", "salida", "ajuste"]);
    await db.movement.create({
      data: {
        organizationId: orgId,
        productId: prod.id,
        type,
        quantity: randInt(1, 20),
        note:
          type === "entrada"
            ? "Compra a proveedor"
            : type === "salida"
              ? "Avería / mermas"
              : "Ajuste de conteo físico",
        createdAt: new Date(now.getTime() - randInt(0, 20) * 86400000 - randInt(0, 82800) * 1000),
      },
    });
  }

  const counts = {
    productos: await db.product.count({ where: { organizationId: orgId } }),
    clientes: await db.customer.count({ where: { organizationId: orgId } }),
    ventas: await db.sale.count({ where: { organizationId: orgId } }),
    movimientos: await db.movement.count({ where: { organizationId: orgId } }),
    suscripciones: await db.subscription.count(),
    facturasSaas: await db.saasInvoice.count(),
    tickets: await db.supportTicket.count(),
  };
  console.log("Semilla completada:", counts, `(${salesCreated} ventas generadas)`);
  console.log("Accesos: super@comerzia.com / admin123 · demo@comerzia.com / demo123");
}

async function main() {
  await ensureSaasCore();
  const orgIds = await ensureDemoOrganizations();
  await ensureSaasDemoData(orgIds);
  await seedBusinessData(orgIds["comerzia-demo"]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
