import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/purchases — lista de órdenes de compra con líneas
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Number(searchParams.get("limit")) || 100);

  const purchases = await db.purchase.findMany({
    where: { organizationId: orgId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ purchases });
}

// POST /api/purchases — crear orden de compra
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const { supplierId, items, note } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "La orden debe incluir al menos un producto." }, { status: 400 });
    }

    let supplierName = "Proveedor directo";
    if (supplierId) {
      const s = await db.supplier.findFirst({ where: { id: supplierId, organizationId: orgId } });
      if (s) supplierName = s.name;
    }

    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds }, organizationId: orgId } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const purchaseItems = (items as Array<{ productId: string; quantity: number; unitCost?: number }>).map(
      (item) => {
        const p = byId.get(item.productId);
        if (!p) throw new Error("Producto no encontrado.");
        const unitCost = Number(item.unitCost) > 0 ? Number(item.unitCost) : p.costPrice;
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity,
          unitCost,
          subtotal: quantity * unitCost,
        };
      }
    );

    const subtotal = purchaseItems.reduce((a: number, it: { subtotal: number }) => a + it.subtotal, 0);
    const taxRate = (ctx.settings.taxRate ?? 19) / 100;
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + tax;

    const count = await db.purchase.count({ where: { organizationId: orgId } });
    const folio = `C-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const purchase = await db.purchase.create({
      data: {
        organizationId: orgId,
        folio,
        supplierId: supplierId || null,
        supplierName,
        subtotal,
        tax,
        total,
        note: note || null,
        items: { create: purchaseItems },
      },
      include: { items: true },
    });

    return NextResponse.json({ purchase }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo crear la orden de compra." }, { status: 400 });
  }
}
