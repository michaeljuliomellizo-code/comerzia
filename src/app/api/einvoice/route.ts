import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/einvoice — documentos electrónicos (ventas completadas con estado DIAN simulado)
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const sales = await db.sale.findMany({
    where: { organizationId: orgId, status: "completada" },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      folio: true,
      customerName: true,
      subtotal: true,
      discount: true,
      couponDiscount: true,
      tax: true,
      total: true,
      cufe: true,
      einvoiceStatus: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ documents: sales });
}

// POST /api/einvoice — emitir (simulado) la factura electrónica de una venta
// Genera el CUFE (SHA-384) y marca el documento como emitido/aceptado.
// NOTA: integración de demostración. En producción, la validación real se hace
// contra la DIAN a través de un proveedor tecnológico autorizado.
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const sale = await db.sale.findFirst({ where: { id: body.saleId, organizationId: orgId }, include: { items: true } });
    if (!sale || sale.status !== "completada") {
      return NextResponse.json({ error: "Venta completada no encontrada." }, { status: 404 });
    }
    if (sale.cufe) {
      return NextResponse.json({ error: "Esta venta ya tiene factura electrónica emitida." }, { status: 409 });
    }

    const nit = ctx.settings.taxId || "900.123.456-7";

    const base = [nit, sale.folio, sale.createdAt.toISOString(), sale.total].join("|");
    const cufe = createHash("sha384").update(base).digest("hex");

    const updated = await db.sale.update({
      where: { id: sale.id },
      data: { cufe, einvoiceStatus: "emitida" },
    });

    return NextResponse.json({
      document: {
        saleId: updated.id,
        folio: updated.folio,
        cufe,
        status: updated.einvoiceStatus,
        issuedAt: new Date().toISOString(),
        issuer: ctx.settings.storeName ?? "COMERZIA",
        nit,
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo emitir la factura electrónica." }, { status: 400 });
  }
}
