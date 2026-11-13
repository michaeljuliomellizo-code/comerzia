import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";
import { parseQty, round3, saleFactor, costPerSaleUnit } from "@/lib/units";

// GET /api/products — lista de productos (con búsqueda y filtro opcional)
// ?supplierId=<uuid> — solo productos asociados a ese proveedor
// ?supplierId=none   — solo productos sin proveedor asignado
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const onlyActive = searchParams.get("active") === "1";
  const supplierId = searchParams.get("supplierId")?.trim() ?? "";

  const products = await db.product.findMany({
    where: {
      AND: [
        { organizationId: orgId },
        q
          ? {
              OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
                { category: { contains: q } },
              ],
            }
          : {},
        category ? { category } : {},
        onlyActive ? { active: true } : {},
        supplierId
          ? supplierId === "none"
            ? { supplierId: null }
            : { supplierId }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}

// POST /api/products — crear producto
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const { name, sku, category, description, costPrice, salePrice, stock, minStock,
            saleUnit, purchaseUnit, unitsPerPurchase, supplierId } = body;

    if (!name || !sku || !category) {
      return NextResponse.json(
        { error: "Nombre, SKU y categoría son obligatorios." },
        { status: 400 }
      );
    }

    const exists = await db.product.findFirst({ where: { organizationId: orgId, sku } });
    if (exists) {
      return NextResponse.json(
        { error: `El SKU "${sku}" ya existe.` },
        { status: 409 }
      );
    }

    // El proveedor (opcional) debe existir dentro de la misma organización.
    let validSupplierId: string | null = null;
    if (supplierId) {
      const supplier = await db.supplier.findFirst({
        where: { id: String(supplierId), organizationId: orgId },
      });
      if (!supplier) {
        return NextResponse.json(
          { error: "El proveedor indicado no existe." },
          { status: 400 }
        );
      }
      validSupplierId = supplier.id;
    }

    // Conversión de unidades: costo digitado es por unidad de COMPRA cuando
    // hay conversión (ej. costo de la resma); se guarda el costo por unidad de
    // venta (por hoja). Sin conversión queda 1:1.
    const unitConfig = {
      saleUnit: saleUnit ? String(saleUnit).toUpperCase() : null,
      purchaseUnit: purchaseUnit ? String(purchaseUnit).toUpperCase() : null,
      unitsPerPurchase: unitsPerPurchase ? round3(Math.abs(Number(unitsPerPurchase) || 0)) || null : null,
    };
    const factor = saleFactor(unitConfig);
    const costPerUnit = unitConfig.unitsPerPurchase && factor > 1
      ? round3(costPerSaleUnit(Number(costPrice) || 0, unitConfig))
      : Number(costPrice) || 0;

    const product = await db.product.create({
      data: {
        organizationId: orgId,
        name,
        sku,
        category,
        description: description ?? null,
        supplierId: validSupplierId,
        ...unitConfig,
        costPrice: costPerUnit,
        salePrice: Number(salePrice) || 0,
        stock: parseQty(stock ?? 0),
        minStock: parseQty(minStock ?? 0),
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
}
