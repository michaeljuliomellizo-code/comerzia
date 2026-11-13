import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/customers — lista de clientes (con búsqueda)
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  const customers = await db.customer.findMany({
    where: {
      organizationId: orgId,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ customers });
}

// POST /api/customers — crear cliente
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const { name, email, phone, docId, type, address, notes } = body;

    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }

    const customer = await db.customer.create({
      data: {
        organizationId: orgId,
        name,
        email: email || null,
        phone: phone || null,
        docId: docId || null,
        type: type === "empresa" ? "empresa" : "particular",
        address: address || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
}
