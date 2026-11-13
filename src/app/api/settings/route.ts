import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/settings — configuración del comercio
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;

  return NextResponse.json({ settings: ctx.settings });
}

// PUT /api/settings — guardar configuración
export async function PUT(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const { storeName, currency, taxRate, lowStockWarn } = body;

    if (!storeName?.trim()) {
      return NextResponse.json({ error: "El nombre del comercio es obligatorio." }, { status: 400 });
    }

    const settings = await db.organizationSetting.update({
      where: { organizationId: orgId },
      data: {
        storeName: storeName.trim() || "Mi Comercio",
        currency: ["COP", "MXN", "USD", "EUR"].includes(currency) ? currency : "COP",
        taxRate: Math.max(0, Math.min(50, Number(taxRate) || 0)),
        lowStockWarn: Boolean(lowStockWarn),
      },
    });

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la configuración." }, { status: 400 });
  }
}
