// ═══════════════════════════════════════════════════════════════════════════
// COMERZIA · Módulo de conversión de unidades (compra → venta)
// ═══════════════════════════════════════════════════════════════════════════
// Casos que resuelve:
//   · Se compra RESMAS de papel y se venden HOJAS   (1 resma = 500 hojas)
//   · Se compra un ROLLO de 100 m y se venden METROS (1 rollo = 100 m)
//   · Se compran CAJAS de puntillas y se venden UNIDADES (1 caja = 50 und)
//
// Reglas del módulo:
//   · El STOCK y los PRECIOS de venta siempre están en la unidad de venta.
//   · Las COMPRAS se registran en la unidad de compra (lo que llega del
//     proveedor); al recibir la mercancía el backend convierte a la unidad
//     de venta y recalcula el costo unitario.
//   · Si el producto no tiene conversión (units_per_purchase null o ≤ 0),
//     todo opera 1:1 como siempre — compatibilidad total con los datos ya
//     creados.
// ═══════════════════════════════════════════════════════════════════════════

// Datos mínimos que necesita este módulo de un producto (compatible con el
// tipo Product de src/components/comerzia/types.ts y con el modelo Prisma).
export interface ProductUnits {
  saleUnit?: string | null;
  purchaseUnit?: string | null;
  unitsPerPurchase?: number | null;
}

// ── Catálogo de unidades de VENTA (unidad mínima que despacha el POS) ──────
export const SALE_UNITS: Array<{ value: string; label: string; decimals: boolean }> = [
  { value: "UNIDAD", label: "Unidad", decimals: false },
  { value: "HOJA", label: "Hoja", decimals: false },
  { value: "METRO", label: "Metro (m)", decimals: true },
  { value: "CENTIMETRO", label: "Centímetro (cm)", decimals: true },
  { value: "KG", label: "Kilogramo (kg)", decimals: true },
  { value: "GRAMO", label: "Gramo (g)", decimals: true },
  { value: "LITRO", label: "Litro (L)", decimals: true },
  { value: "MILILITRO", label: "Mililitro (ml)", decimals: true },
  { value: "SERVICIO", label: "Servicio / hora", decimals: false },
];

// ── Catálogo de unidades de COMPRA (presentaciones del proveedor) ──────────
export const PURCHASE_UNITS: Array<{ value: string; label: string }> = [
  { value: "RESMA", label: "Resma" },
  { value: "ROLLO", label: "Rollo" },
  { value: "CAJA", label: "Caja" },
  { value: "PAQUETE", label: "Paquete" },
  { value: "FARDO", label: "Fardo" },
  { value: "DOCENA", label: "Docena" },
  { value: "BULTO", label: "Bulto" },
  { value: "BARRA", label: "Barra / tubo" },
  { value: "LATA", label: "Lata" },
  { value: "GALON", label: "Galón / caneca" },
  { value: "UNIDAD", label: "Unidad (igual a la venta)" },
];

// Etiqueta corta para mostrar en pantalla ("HOJA", "1.5 m"…)
export function unitLabel(code?: string | null): string {
  if (!code) return "und";
  return code.toLowerCase();
}

// ── Factor de conversión compra → venta ────────────────────────────────────
// 1 unidad de compra contiene `factor` unidades de venta (500 hojas/resma).
// Sin conversión definida → 1 (comportamiento anterior intacto).
export function saleFactor(p: ProductUnits): number {
  const f = Number(p.unitsPerPurchase);
  return Number.isFinite(f) && f > 0 ? f : 1;
}

// ¿El producto usa conversión de unidades?
export function hasConversion(p: ProductUnits): boolean {
  return Boolean(p.purchaseUnit && p.saleUnit) && saleFactor(p) !== 1;
}

// Costo por unidad de VENTA a partir del costo por unidad de COMPRA.
// Ej.: resma $12.900 / 500 hojas = $25.80 por hoja.
export function costPerSaleUnit(purchaseUnitCost: number, p: ProductUnits): number {
  const factor = saleFactor(p);
  if (factor === 1) return purchaseUnitCost;
  return purchaseUnitCost / factor;
}

// Cantidad de unidades de VENTA que entran al stock al recibir `qty` de compra.
// Ej.: 2 resmas × 500 = 1000 hojas; 1 rollo × 100 = 100 m.
export function purchaseToSaleQty(purchaseQty: number, p: ProductUnits): number {
  return round3(purchaseQty * saleFactor(p));
}

// Texto "1 RESMA = 500 HOJAS" para mostrar en formularios y listas.
export function conversionLabel(p: ProductUnits): string | null {
  if (!p.purchaseUnit || !p.saleUnit) return null;
  return `1 ${p.purchaseUnit} = ${trimNum(saleFactor(p))} ${p.saleUnit}`;
}

// ── Utilidades numéricas ───────────────────────────────────────────────────
// Redondeo a 3 decimales (evita el 0.30000000000000004 del POS con metros).
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// "1.500" → "1,5" · "2.000" → "2"  (para stock y cantidades en pantalla)
export function trimNum(n: number): string {
  const r = round3(n);
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

// Normaliza una cantidad digitada: número ≥ 0 con 3 decimales.
export function parseQty(value: string | number, min = 0): number {
  const n = round3(Math.abs(Number(String(value).replace(",", ".")) || 0));
  return Math.max(min, n);
}

// Decimales permitidos según la unidad de venta (metros/kg: sí; hojas: no).
export function unitAllowsDecimals(saleUnit?: string | null): boolean {
  const u = SALE_UNITS.find((x) => x.value === (saleUnit ?? "").toUpperCase());
  return u?.decimals ?? false;
}
