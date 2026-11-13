// Tipos compartidos de COMERZIA

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string | null;
  supplierId?: string | null;        // proveedor asociado (compras)
  // Módulo de conversión de unidades: compra por presentación, venta por unidad mínima
  saleUnit?: string | null;          // unidad mínima de venta (HOJA, METRO, UNIDAD…)
  purchaseUnit?: string | null;      // unidad de compra (RESMA, ROLLO, CAJA…)
  unitsPerPurchase?: number | null;  // unidades de venta contenidas en 1 unidad de compra
  costPrice: number;
  salePrice: number;
  wholesalePrice?: number | null;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  docId: string | null;
  type: "particular" | "empresa" | string;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  folio: string;
  customerId: string | null;
  customerName: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: "efectivo" | "tarjeta" | "transferencia" | string;
  status: "completada" | "pendiente" | "cancelada" | string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SaleItem[];
}

export interface Movement {
  id: string;
  productId: string;
  type: "entrada" | "salida" | "ajuste" | string;
  quantity: number;
  note: string | null;
  createdAt: string;
  product?: { name: string; sku: string; stock: number };
}

export interface Supplier {
  id: string;
  name: string;
  taxId: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTerms: "contado" | "credito_15" | "credito_30" | string;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  folio: string;
  supplierId: string | null;
  supplierName: string;
  status: "pendiente" | "recibida" | "cancelada" | string;
  subtotal: number;
  tax: number;
  total: number;
  paid: boolean;
  note: string | null;
  createdAt: string;
  receivedAt: string | null;
  items?: PurchaseItem[];
}

export interface CashMovement {
  id: string;
  sessionId: string;
  type: "ingreso" | "egreso" | string;
  amount: number;
  concept: string;
  source: string;
  createdAt: string;
}

export interface CashSession {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  status: "abierta" | "cerrada" | string;
  openedBy: string;
  notes: string | null;
  movements?: CashMovement[];
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  productId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Quotation {
  id: string;
  folio: string;
  customerId: string | null;
  customerName: string;
  status: "borrador" | "enviada" | "aprobada" | "rechazada" | "convertida" | string;
  validUntil: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items?: QuotationItem[];
}

export interface Coupon {
  id: string;
  code: string;
  type: "porcentaje" | "monto" | string;
  value: number;
  minTotal: number;
  active: boolean;
  expiresAt: string | null;
  usageCount: number;
  createdAt: string;
}

export interface FinanceTransaction {
  id: string;
  type: "ingreso" | "egreso" | string;
  category: string;
  amount: number;
  method: string;
  description: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string | null;
  active: boolean;
  lastAccess: string | null;
  createdAt: string;
}

export interface Settings {
  id?: string;
  organizationId?: string;
  storeName: string;
  currency: "COP" | "MXN" | "USD" | "EUR" | string;
  taxRate: number;
  lowStockWarn: boolean;
  taxId?: string | null;
  address?: string | null;
  updatedAt?: string;
}

export interface Metrics {
  kpis: {
    revenueToday: number;
    salesToday: number;
    revenueMonth: number;
    revenue30: number;
    revenuePrev30: number;
    growth: number | null;
    avgTicket: number;
    totalCustomers: number;
    totalProducts: number;
    pendingSales: number;
    lowStockCount: number;
    // KPIs ERP
    itemsSoldMonth: number;
    purchasesMonth: number;
    arBalance: number;
    apTotal: number;
    inventoryValue: number;
    inventoryUnits: number;
    outOfStock: number;
    usersActive: number;
  };
  dailySeries: Array<{ date: string; revenue: number; count: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  categoryRevenue: Array<{ category: string; revenue: number }>;
  paymentMethods: Array<{ method: string; revenue: number }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    stock: number;
    minStock: number;
  }>;
  recentSales: Array<{
    id: string;
    folio: string;
    customerName: string;
    total: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
  }>;
}

export const CATEGORY_BADGE: Record<string, string> = {
  Bebidas: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  Abarrotes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Panadería: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  Aseo: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  Hogar: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300",
};
