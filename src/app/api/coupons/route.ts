import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/coupons — lista de cupones
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const coupons = await db.coupon.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ coupons });
}

// POST /api/coupons — crear cupón
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "El código del cupón es obligatorio." }, { status: 400 });
    }
    const value = Number(body.value) || 0;
    if (value <= 0) {
      return NextResponse.json({ error: "El valor del cupón debe ser mayor a cero." }, { status: 400 });
    }
    if (body.type === "porcentaje" && value > 100) {
      return NextResponse.json({ error: "El porcentaje no puede superar 100 %." }, { status: 400 });
    }

    const exists = await db.coupon.findFirst({ where: { organizationId: orgId, code } });
    if (exists) {
      return NextResponse.json({ error: `Ya existe un cupón con el código ${code}.` }, { status: 409 });
    }

    const coupon = await db.coupon.create({
      data: {
        organizationId: orgId,
        code,
        type: body.type === "monto" ? "monto" : "porcentaje",
        value,
        minTotal: Math.max(0, Number(body.minTotal) || 0),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo crear el cupón." }, { status: 400 });
  }
}
