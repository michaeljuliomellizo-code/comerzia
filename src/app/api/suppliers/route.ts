import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/suppliers — lista de proveedores
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const suppliers = await db.supplier.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ suppliers });
}

// POST /api/suppliers — crear proveedor
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "El nombre del proveedor es obligatorio." }, { status: 400 });
    }
    const supplier = await db.supplier.create({
      data: {
        organizationId: orgId,
        name: String(body.name).trim(),
        taxId: body.taxId || null,
        contactName: body.contactName || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        paymentTerms: ["contado", "credito_15", "credito_30"].includes(body.paymentTerms)
          ? body.paymentTerms
          : "contado",
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo crear el proveedor." }, { status: 400 });
  }
}
