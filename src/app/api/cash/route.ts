import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/cash — sesión abierta (+movimientos) y sesiones cerradas recientes
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const [open, closed] = await Promise.all([
    db.cashSession.findFirst({
      where: { organizationId: orgId, status: "abierta" },
      include: { movements: { orderBy: { createdAt: "desc" } } },
    }),
    db.cashSession.findMany({
      where: { organizationId: orgId, status: "cerrada" },
      orderBy: { openedAt: "desc" },
      take: 10,
    }),
  ]);
  return NextResponse.json({ open, closed });
}

// POST /api/cash — acciones: open | close | movement
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const action = body.action;

    if (action === "open") {
      const existing = await db.cashSession.findFirst({ where: { organizationId: orgId, status: "abierta" } });
      if (existing) {
        return NextResponse.json({ error: "Ya existe una sesión de caja abierta." }, { status: 409 });
      }
      const session = await db.cashSession.create({
        data: {
          organizationId: orgId,
          openingAmount: Math.max(0, Number(body.openingAmount) || 0),
          openedById: ctx.profile.id,
          openedByName: body.openedBy?.trim() || ctx.profile.fullName || "Cajero",
        },
        include: { movements: true },
      });
      return NextResponse.json({ session }, { status: 201 });
    }

    if (action === "close") {
      const session = await db.cashSession.findFirst({
        where: { organizationId: orgId, status: "abierta" },
        include: { movements: true },
      });
      if (!session) {
        return NextResponse.json({ error: "No hay una sesión de caja abierta." }, { status: 409 });
      }
      // Efectivo esperado: base inicial + ingresos manuales − egresos manuales
      // (las ventas con tarjeta/transferencia no pasan por el cajón)
      const cashIn = session.movements
        .filter((m) => m.type === "ingreso")
        .reduce((a, m) => a + m.amount, 0);
      const cashOut = session.movements
        .filter((m) => m.type === "egreso")
        .reduce((a, m) => a + m.amount, 0);
      const expected = session.openingAmount + cashIn - cashOut;
      const closing = Math.max(0, Number(body.closingAmount) || 0);
      const difference = Math.round((closing - expected) * 100) / 100;

      const closed = await db.cashSession.update({
        where: { id: session.id },
        data: {
          status: "cerrada",
          closedAt: new Date(),
          closingAmount: closing,
          expectedAmount: expected,
          difference,
          notes: body.notes || null,
        },
        include: { movements: true },
      });
      return NextResponse.json({ session: closed });
    }

    if (action === "movement") {
      const session = await db.cashSession.findFirst({ where: { organizationId: orgId, status: "abierta" } });
      if (!session) {
        return NextResponse.json({ error: "No hay una sesión de caja abierta." }, { status: 409 });
      }
      const amount = Number(body.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "El monto debe ser mayor a cero." }, { status: 400 });
      }
      if (!body.concept?.trim()) {
        return NextResponse.json({ error: "El concepto es obligatorio." }, { status: 400 });
      }
      const movement = await db.cashMovement.create({
        data: {
          organizationId: orgId,
          sessionId: session.id,
          type: body.type === "egreso" ? "egreso" : "ingreso",
          amount,
          concept: String(body.concept).trim(),
          source: "manual",
        },
      });
      return NextResponse.json({ movement }, { status: 201 });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la operación de caja." }, { status: 400 });
  }
}
