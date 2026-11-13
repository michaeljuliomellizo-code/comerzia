import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/finance — resumen financiero: transacciones, CxC, CxP y KPIs
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [transactions, creditSales, openPurchases, expensesMonth, incomeMonth, purchasesMonth] =
    await Promise.all([
      db.financeTransaction.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 120 }),
      db.sale.findMany({
        where: { organizationId: orgId, paymentMethod: "credito", status: "completada" },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.purchase.findMany({
        where: { organizationId: orgId, status: "recibida", paid: false },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.financeTransaction.aggregate({
        where: { organizationId: orgId, type: "egreso", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.financeTransaction.aggregate({
        where: { organizationId: orgId, type: "ingreso", category: { not: "abono_cliente" }, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      db.purchase.aggregate({
        where: { organizationId: orgId, status: { not: "cancelada" }, createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
    ]);

  // Abonos por venta (cuentas por cobrar)
  const abonos = await db.financeTransaction.findMany({
    where: { organizationId: orgId, category: "abono_cliente", refType: "sale" },
  });
  const abonosBySale = new Map<string, number>();
  for (const a of abonos) {
    if (!a.refId) continue;
    abonosBySale.set(a.refId, (abonosBySale.get(a.refId) ?? 0) + a.amount);
  }

  const accountsReceivable = creditSales.map((s) => ({
    id: s.id,
    folio: s.folio,
    customerName: s.customerName,
    total: s.total,
    paid: abonosBySale.get(s.id) ?? 0,
    balance: Math.max(0, s.total - (abonosBySale.get(s.id) ?? 0)),
    createdAt: s.createdAt,
  }));

  const arTotal = accountsReceivable.reduce((a, r) => a + r.balance, 0);
  const apTotal = openPurchases.reduce((a, p) => a + p.total, 0);

  return NextResponse.json({
    transactions,
    accountsReceivable: accountsReceivable.filter((r) => r.balance > 0),
    accountsPayable: openPurchases.map((p) => ({
      id: p.id,
      folio: p.folio,
      supplierName: p.supplierName,
      total: p.total,
      createdAt: p.createdAt,
    })),
    kpis: {
      arTotal,
      arCount: accountsReceivable.filter((r) => r.balance > 0).length,
      apTotal,
      apCount: openPurchases.length,
      expensesMonth: expensesMonth._sum.amount ?? 0,
      otherIncomeMonth: incomeMonth._sum.amount ?? 0,
      purchasesMonth: purchasesMonth._sum.total ?? 0,
    },
  });
}

// POST /api/finance — registrar movimiento manual o abono de cliente
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();

    // Abono a cuenta por cobrar
    if (body.action === "abono") {
      const sale = await db.sale.findFirst({ where: { id: body.saleId, organizationId: orgId } });
      if (!sale || sale.paymentMethod !== "credito") {
        return NextResponse.json({ error: "Venta a crédito no encontrada." }, { status: 404 });
      }
      const amount = Number(body.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "El abono debe ser mayor a cero." }, { status: 400 });
      }
      const abonos = await db.financeTransaction.aggregate({
        where: { organizationId: orgId, category: "abono_cliente", refType: "sale", refId: sale.id },
        _sum: { amount: true },
      });
      const paidSoFar = abonos._sum.amount ?? 0;
      if (paidSoFar + amount > sale.total) {
        return NextResponse.json(
          { error: `El abono supera el saldo pendiente ($ ${(sale.total - paidSoFar).toLocaleString("es-CO")}).` },
          { status: 409 }
        );
      }
      const tx = await db.financeTransaction.create({
        data: {
          organizationId: orgId,
          type: "ingreso",
          category: "abono_cliente",
          amount,
          method: body.method || "efectivo",
          description: `Abono venta ${sale.folio} — ${sale.customerName}`,
          refType: "sale",
          refId: sale.id,
        },
      });
      return NextResponse.json({ transaction: tx }, { status: 201 });
    }

    // Movimiento manual de ingreso / egreso
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a cero." }, { status: 400 });
    }
    if (!body.description?.trim()) {
      return NextResponse.json({ error: "La descripción es obligatoria." }, { status: 400 });
    }
    const tx = await db.financeTransaction.create({
      data: {
        organizationId: orgId,
        type: body.type === "egreso" ? "egreso" : "ingreso",
        category: body.category || "operativo",
        amount,
        method: body.method || "efectivo",
        description: String(body.description).trim(),
      },
    });
    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el movimiento." }, { status: 400 });
  }
}
