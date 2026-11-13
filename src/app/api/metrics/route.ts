import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/metrics — KPIs y series para el panel
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const days30 = new Date(startOfToday);
  days30.setDate(days30.getDate() - 29);
  const prev30Start = new Date(days30);
  prev30Start.setDate(prev30Start.getDate() - 30);

  const [
    todaySales,
    monthSales,
    totalCustomers,
    totalProducts,
    lowStock,
    last30,
    prev30,
    byCategory,
    topProducts,
    recentSales,
    pendingCount,
    inventoryAgg,
    outOfStockCount,
    purchasesMonth,
    creditSales,
    abonos,
    openPurchases,
    usersCount,
    itemsMonth,
  ] = await Promise.all([
    db.sale.findMany({
      where: { organizationId: orgId, status: "completada", createdAt: { gte: startOfToday } },
      select: { total: true },
    }),
    db.sale.findMany({
      where: { organizationId: orgId, status: "completada", createdAt: { gte: startOfMonth } },
      select: { total: true },
    }),
    db.customer.count({ where: { organizationId: orgId } }),
    db.product.count({ where: { organizationId: orgId } }),
    db.product.findMany({
      where: { organizationId: orgId },
      orderBy: { stock: "asc" },
      take: 6,
    }),
    db.sale.findMany({
      where: { organizationId: orgId, status: "completada", createdAt: { gte: days30 } },
      select: { total: true, createdAt: true },
    }),
    db.sale.findMany({
      where: { organizationId: orgId, status: "completada", createdAt: { gte: prev30Start, lt: days30 } },
      select: { total: true },
    }),
    db.sale.findMany({
      where: { organizationId: orgId, status: "completada", createdAt: { gte: days30 } },
      select: { items: { select: { name: true, quantity: true, subtotal: true } } },
    }),
    db.saleItem.findMany({
      where: { organizationId: orgId, sale: { status: "completada", createdAt: { gte: days30 } } },
      select: { name: true, quantity: true, subtotal: true },
    }),
    db.sale.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        folio: true,
        customerName: true,
        total: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
      },
    }),
    db.sale.count({ where: { organizationId: orgId, status: "pendiente" } }),
    db.product.findMany({ where: { organizationId: orgId, active: true }, select: { stock: true, costPrice: true } }),
    db.product.count({ where: { organizationId: orgId, stock: 0, active: true } }),
    db.purchase.aggregate({
      where: { organizationId: orgId, status: { not: "cancelada" }, createdAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    db.sale.findMany({
      where: { organizationId: orgId, paymentMethod: "credito", status: "completada" },
      select: { id: true, total: true },
    }),
    db.financeTransaction.findMany({
      where: { organizationId: orgId, category: "abono_cliente", refType: "sale" },
      select: { refId: true, amount: true },
    }),
    db.purchase.findMany({
      where: { organizationId: orgId, status: "recibida", paid: false },
      select: { total: true },
    }),
    db.organizationMember.count({ where: { organizationId: orgId, active: true } }),
    db.saleItem.findMany({
      where: { organizationId: orgId, sale: { status: "completada", createdAt: { gte: startOfMonth } } },
      select: { quantity: true },
    }),
  ]);

  // Cuentas por cobrar: ventas a crédito menos abonos recibidos
  const abonosBySale = new Map<string, number>();
  for (const a of abonos) {
    if (!a.refId) continue;
    abonosBySale.set(a.refId, (abonosBySale.get(a.refId) ?? 0) + a.amount);
  }
  const arBalance = creditSales.reduce(
    (a, s) => a + Math.max(0, s.total - (abonosBySale.get(s.id) ?? 0)),
    0
  );
  const apTotal = openPurchases.reduce((a, p) => a + p.total, 0);

  // Serie diaria de ventas (30 días)
  const dayMap = new Map<string, { revenue: number; count: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(days30);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { revenue: 0, count: 0 });
  }
  for (const s of last30) {
    const key = s.createdAt.toISOString().slice(0, 10);
    const entry = dayMap.get(key);
    if (entry) {
      entry.revenue += s.total;
      entry.count += 1;
    }
  }
  const dailySeries = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));

  // Ventas por categoría (últimos 30 días)
  const catMap = new Map<string, number>();
  for (const s of byCategory) {
    for (const it of s.items) {
      // La categoría no está en la línea: se aproxima por producto más vendido en topProducts
      catMap.set(it.name, (catMap.get(it.name) ?? 0) + it.subtotal);
    }
  }

  // Top productos por ingresos (últimos 30 días)
  const prodMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const it of topProducts) {
    const cur = prodMap.get(it.name) ?? { name: it.name, quantity: 0, revenue: 0 };
    cur.quantity += it.quantity;
    cur.revenue += it.subtotal;
    prodMap.set(it.name, cur);
  }
  const top = Array.from(prodMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Métodos de pago (últimos 30 días)
  const payRaw = await db.sale.findMany({
    where: { organizationId: orgId, status: "completada", createdAt: { gte: days30 } },
    select: { paymentMethod: true, total: true },
  });
  const payMap = new Map<string, number>();
  for (const p of payRaw) payMap.set(p.paymentMethod, (payMap.get(p.paymentMethod) ?? 0) + p.total);

  // Ingresos por categoría real (joineando productos)
  const productCats = await db.product.findMany({ where: { organizationId: orgId }, select: { id: true, category: true } });
  const catById = new Map(productCats.map((p) => [p.id, p.category]));
  const catRevenue = new Map<string, number>();
  for (const s of byCategory) {
    for (const it of s.items) {
      // it tiene name; para categoría usamos productId si existiera en items — aproximamos con topProducts
      void it;
    }
  }
  // Versión precisa: líneas de venta con productId
  const itemsWithCat = await db.saleItem.findMany({
    where: { organizationId: orgId, sale: { status: "completada", createdAt: { gte: days30 } } },
    select: { productId: true, subtotal: true },
  });
  for (const it of itemsWithCat) {
    if (!it.productId) continue;
    const cat = catById.get(it.productId) ?? "Otros";
    catRevenue.set(cat, (catRevenue.get(cat) ?? 0) + it.subtotal);
  }
  void catMap;

  const revenue30 = last30.reduce((a, s) => a + s.total, 0);
  const revenuePrev30 = prev30.reduce((a, s) => a + s.total, 0);
  const growth =
    revenuePrev30 > 0
      ? Math.round(((revenue30 - revenuePrev30) / revenuePrev30) * 1000) / 10
      : null;

  return NextResponse.json({
    kpis: {
      revenueToday: todaySales.reduce((a, s) => a + s.total, 0),
      salesToday: todaySales.length,
      revenueMonth: monthSales.reduce((a, s) => a + s.total, 0),
      revenue30,
      revenuePrev30,
      growth,
      avgTicket: last30.length > 0 ? revenue30 / last30.length : 0,
      totalCustomers,
      totalProducts,
      pendingSales: pendingCount,
      lowStockCount: lowStock.filter((p) => p.stock <= p.minStock).length,
      // KPIs ERP
      itemsSoldMonth: itemsMonth.reduce((a, i) => a + i.quantity, 0),
      purchasesMonth: purchasesMonth._sum.total ?? 0,
      arBalance,
      apTotal,
      inventoryValue: Math.round(inventoryAgg.reduce((a, p) => a + p.stock * p.costPrice, 0)),
      inventoryUnits: inventoryAgg.reduce((a, p) => a + p.stock, 0),
      outOfStock: outOfStockCount,
      usersActive: usersCount,
    },
    dailySeries,
    topProducts: top,
    categoryRevenue: Array.from(catRevenue.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    paymentMethods: Array.from(payMap.entries()).map(([method, revenue]) => ({
      method,
      revenue,
    })),
    lowStockProducts: lowStock
      .filter((p) => p.stock <= p.minStock)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        minStock: p.minStock,
      })),
    recentSales,
  });
}
