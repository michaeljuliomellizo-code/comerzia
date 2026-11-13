import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// POST /api/coupons/validate — valida un cupón contra un subtotal y devuelve el descuento
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const subtotal = Math.max(0, Number(body.subtotal) || 0);

    if (!code) {
      return NextResponse.json({ error: "Ingresa el código del cupón." }, { status: 400 });
    }

    const coupon = await db.coupon.findFirst({ where: { organizationId: orgId, code } });
    if (!coupon || !coupon.active) {
      return NextResponse.json({ error: "Cupón no válido o inactivo." }, { status: 404 });
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: "El cupón está vencido." }, { status: 409 });
    }
    if (subtotal < coupon.minTotal) {
      return NextResponse.json(
        {
          error: `El cupón exige un subtotal mínimo de ${coupon.minTotal.toLocaleString("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
          })}.`,
        },
        { status: 409 }
      );
    }

    const discount =
      coupon.type === "porcentaje"
        ? Math.round((subtotal * coupon.value) / 100)
        : Math.min(coupon.value, subtotal);

    return NextResponse.json({
      coupon: { code: coupon.code, type: coupon.type, value: coupon.value },
      discount,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo validar el cupón." }, { status: 400 });
  }
}
