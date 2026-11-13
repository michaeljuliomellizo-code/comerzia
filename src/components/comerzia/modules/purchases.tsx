"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MinusCircle, Package, PackagePlus, Plus, ReceiptText, Search, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoreSettings } from "../dashboard";
import type { Product, Purchase, Supplier } from "../types";
import { formatMoney } from "@/lib/format";
import { parseQty, round3, saleFactor, conversionLabel, purchaseToSaleQty, trimNum, unitLabel, SALE_UNITS, PURCHASE_UNITS } from "@/lib/units";

type CartLine = { productId: string; name: string; sku: string; quantity: number; unitCost: number;
  saleUnit?: string | null; purchaseUnit?: string | null; unitsPerPurchase?: number | null };

const STATUS_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  recibida: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelada: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export default function PurchasesModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toReceive, setToReceive] = useState<Purchase | null>(null);
  const [toCancel, setToCancel] = useState<Purchase | null>(null);
  const [toPay, setToPay] = useState<Purchase | null>(null);

  // Formulario de nueva orden
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickId, setPickId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [pickCost, setPickCost] = useState("");

  // Proveedor nuevo desde la orden
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [supForm, setSupForm] = useState({ name: "", taxId: "", phone: "" });
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // Producto nuevo desde la orden (referencias nuevas que trae el proveedor)
  const [newProdOpen, setNewProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState({
    name: "", sku: "", category: "", description: "",
    costPrice: "0", salePrice: "0", stock: "0", minStock: "5",
    saleUnit: "", purchaseUnit: "", unitsPerPurchase: "",
  });
  const [prodSupplierId, setProdSupplierId] = useState("");
  const [creatingProd, setCreatingProd] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Catálogo del selector: si hay proveedor seleccionado muestra solo sus
  // productos asociados; sin proveedor muestra todos los activos.
  const catalogProducts = useMemo(() => {
    const active = products.filter((p) => p.active);
    if (!supplierId) return active;
    if (showAllProducts) return active;
    return active.filter((p) => p.supplierId === supplierId);
  }, [products, supplierId, showAllProducts]);

  const ownProductsCount = useMemo(
    () => products.filter((p) => p.active && p.supplierId === supplierId).length,
    [products, supplierId]
  );

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/purchases?limit=200").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([p, s, pr]) => {
        if (!alive) return;
        setPurchases(p.purchases ?? []);
        setSuppliers(s.suppliers ?? []);
        setProducts(pr.products ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter(
      (p) =>
        p.folio.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        (p.items ?? []).some((i) => i.name.toLowerCase().includes(q))
    );
  }, [purchases, query]);

  const addToCart = () => {
    const p = products.find((x) => x.id === pickId);
    if (!p) {
      toast.error("Selecciona un producto del catálogo.");
      return;
    }
    // Cantidades decimales (2.5 rollos…); la cantidad digitada es en la
    // unidad de COMPRA. Al recibir, el backend convierte a la unidad de venta.
    const qty = parseQty(pickQty, 0.001);
    const cost = Number(pickCost.replace(",", ".")) > 0
      ? Number(pickCost.replace(",", "."))
      : round3(p.costPrice * saleFactor(p)); // costo por unidad de compra
    setCart((c) => [
      ...c.filter((l) => l.productId !== p.id),
      {
        productId: p.id, name: p.name, sku: p.sku, quantity: qty, unitCost: cost,
        saleUnit: p.saleUnit ?? null, purchaseUnit: p.purchaseUnit ?? null,
        unitsPerPurchase: p.unitsPerPurchase ?? null,
      },
    ]);
    setPickId("");
    setPickQty("1");
    setPickCost("");
  };

  const subtotal = cart.reduce((a, l) => a + l.quantity * l.unitCost, 0);

  const createOrder = async () => {
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto a la orden.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: supplierId || null, note, items: cart }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear la orden.");
        return;
      }
      toast.success(`Orden ${data.purchase.folio} creada.`);
      setDialogOpen(false);
      setCart([]);
      setNote("");
      setSupplierId("");
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  // Crea un proveedor nuevo desde la orden y lo deja seleccionado.
  const createSupplierInline = async () => {
    if (!supForm.name.trim()) {
      toast.error("El nombre del proveedor es obligatorio.");
      return;
    }
    setCreatingSupplier(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supForm.name.trim(),
          taxId: supForm.taxId.trim() || null,
          phone: supForm.phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear el proveedor.");
        return;
      }
      setSuppliers((s) => [...s, data.supplier as Supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(data.supplier.id);
      setNewSupplierOpen(false);
      setSupForm({ name: "", taxId: "", phone: "" });
      toast.success(`Proveedor "${data.supplier.name}" creado. Ahora agrega sus productos.`);
    } finally {
      setCreatingSupplier(false);
    }
  };

  // Crea un producto nuevo (referencia nueva que trae el proveedor) desde la
  // orden; al quedar creado queda asociado al proveedor y preseleccionado.
  const createProductInline = async () => {
    if (!prodForm.name.trim() || !prodForm.sku.trim() || !prodForm.category.trim()) {
      toast.error("Nombre, SKU y categoría son obligatorios.");
      return;
    }
    setCreatingProd(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prodForm.name.trim(),
          sku: prodForm.sku.trim().toUpperCase(),
          category: prodForm.category.trim(),
          description: prodForm.description.trim() || null,
          costPrice: Number(prodForm.costPrice.replace(",", ".")) || 0,
          salePrice: Number(prodForm.salePrice.replace(",", ".")) || 0,
          stock: Number(prodForm.stock.replace(",", ".")) || 0,
          minStock: Number(prodForm.minStock.replace(",", ".")) || 0,
          saleUnit: prodForm.saleUnit || null,
          purchaseUnit: prodForm.purchaseUnit || null,
          unitsPerPurchase: prodForm.unitsPerPurchase
            ? Number(prodForm.unitsPerPurchase.replace(",", ".")) || null
            : null,
          supplierId: prodSupplierId && prodSupplierId !== "__none__" ? prodSupplierId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear el producto.");
        return;
      }
      const created = data.product as Product;
      const fresh = await fetch("/api/products").then((r) => r.json());
      setProducts(fresh.products ?? []);
      // Queda listo para agregar a la orden con su costo por unidad de compra.
      setPickId(created.id);
      setPickQty("1");
      setPickCost(String(round3(created.costPrice * saleFactor(created))));
      if (!supplierId && prodSupplierId && prodSupplierId !== "__none__") setSupplierId(prodSupplierId);
      setNewProdOpen(false);
      setProdForm({
        name: "", sku: "", category: "", description: "",
        costPrice: "0", salePrice: "0", stock: "0", minStock: "5",
        saleUnit: "", purchaseUnit: "", unitsPerPurchase: "",
      });
      toast.success(`Producto "${created.name}" creado y listo para agregar.`);
    } finally {
      setCreatingProd(false);
    }
  };

  const action = async (p: Purchase, act: "receive" | "cancel" | "pay") => {
    const res = await fetch(`/api/purchases/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo completar la acción.");
      return;
    }
    if (act === "receive") toast.success(`Compra ${p.folio} recibida: stock actualizado.`);
    if (act === "cancel") toast.success(`Orden ${p.folio} anulada.`);
    if (act === "pay") toast.success(`Pago de ${p.folio} registrado en finanzas.`);
    setToReceive(null);
    setToCancel(null);
    setToPay(null);
    setDetail(null);
    notifyChange();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por folio, proveedor o producto…"
              className="pl-8"
              aria-label="Buscar compras"
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nueva orden de compra
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No hay órdenes de compra registradas.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                    <TableCell className="font-medium">{p.folio}</TableCell>
                    <TableCell className="max-w-48 truncate">{p.supplierName}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell className="font-semibold">{formatMoney(p.total, currency)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[p.status]}>
                        {p.status === "pendiente" ? "Pendiente" : p.status === "recibida" ? "Recibida" : "Anulada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "pendiente" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToReceive(p);
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Recibir
                        </Button>
                      )}
                      {p.status === "recibida" && !p.paid && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToPay(p);
                          }}
                        >
                          <Wallet className="mr-1 h-3.5 w-3.5" /> Pagar
                        </Button>
                      )}
                      {p.status === "recibida" && p.paid && (
                        <span className="text-xs text-muted-foreground">Pagada ✓</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detalle de la orden */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" /> Compra {detail.folio}
                </DialogTitle>
                <DialogDescription>
                  {detail.supplierName} ·{" "}
                  {new Date(detail.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead>Costo unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.items ?? []).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <p className="font-medium">{it.name}</p>
                          <p className="text-xs text-muted-foreground">{it.sku}</p>
                        </TableCell>
                        <TableCell>{it.quantity}</TableCell>
                        <TableCell>{formatMoney(it.unitCost, currency)}</TableCell>
                        <TableCell className="text-right">{formatMoney(it.subtotal, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(detail.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span>{formatMoney(detail.tax, currency)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatMoney(detail.total, currency)}</span>
                </div>
                {detail.note && <p className="pt-2 text-xs text-muted-foreground">Nota: {detail.note}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {detail.status === "pendiente" && (
                  <>
                    <Button onClick={() => setToReceive(detail)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Recibir mercancía
                    </Button>
                    <Button variant="destructive" onClick={() => setToCancel(detail)}>
                      <MinusCircle className="mr-1.5 h-4 w-4" /> Anular orden
                    </Button>
                  </>
                )}
                {detail.status === "recibida" && !detail.paid && (
                  <Button onClick={() => setToPay(detail)}>
                    <Wallet className="mr-1.5 h-4 w-4" /> Registrar pago
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nueva orden de compra */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto thin-scroll sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva orden de compra</DialogTitle>
            <DialogDescription>
              Al recibir la orden, el stock aumenta y se registran los movimientos de entrada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Proveedor</Label>
                <Select
                  value={supplierId}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      setNewSupplierOpen(true);
                      return;
                    }
                    setSupplierId(v);
                    // Al cambiar de proveedor el catálogo cambia: limpiar la selección.
                    setPickId("");
                    setPickCost("");
                    setShowAllProducts(false);
                  }}
                >
                  <SelectTrigger aria-label="Proveedor">
                    <SelectValue placeholder="Selecciona un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers
                      .filter((s) => s.active)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    <SelectItem value="__new__" className="text-primary font-medium">
                      <span className="flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" /> Nuevo proveedor…
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {supplierId && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      id="p-show-all"
                      checked={showAllProducts}
                      onCheckedChange={(v) => setShowAllProducts(v === true)}
                    />
                    <label htmlFor="p-show-all" className="cursor-pointer">
                      Mostrar todos los productos ({ownProductsCount} asociados a este proveedor)
                    </label>
                  </div>
                )}
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Producto</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setProdSupplierId(supplierId || "__none__");
                      setNewProdOpen(true);
                    }}
                  >
                    <PackagePlus className="mr-1 h-3.5 w-3.5" /> Nuevo producto
                  </Button>
                </div>
                <Select
                  value={pickId}
                  onValueChange={(v) => {
                    setPickId(v);
                    const p = products.find((x) => x.id === v);
                    // Costo sugerido por unidad de COMPRA (costo por unidad de venta × contenido)
                    if (p) setPickCost(String(round3(p.costPrice * saleFactor(p))));
                  }}
                  disabled={catalogProducts.length === 0}
                >
                  <SelectTrigger aria-label="Producto">
                    <SelectValue
                      placeholder={
                        supplierId && !showAllProducts && catalogProducts.length === 0
                          ? "Este proveedor no tiene productos aún"
                          : "Selecciona un producto"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {catalogProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {supplierId && !showAllProducts && catalogProducts.length === 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                Este proveedor aún no tiene productos asociados. Usa el botón{" "}
                <strong>“Nuevo producto”</strong> para registrar las referencias nuevas que trae; quedarán
                asociadas a este proveedor para tus próximas órdenes.
              </p>
            )}
            {(() => {
              const sel = products.find((x) => x.id === pickId);
              if (!sel) return null;
              const conv = conversionLabel(sel);
              if (!conv) return null;
              const willAdd = purchaseToSaleQty(parseQty(pickQty, 0.001), sel);
              return (
                <p className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                  {conv} · al recibir esta orden el stock sube en {trimNum(willAdd)}{" "}
                  {unitLabel(sel.saleUnit)}
                </p>
              );
            })()}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-qty">Cantidad{(() => {
                  const sel = products.find((x) => x.id === pickId);
                  return sel?.purchaseUnit ? ` (${sel.purchaseUnit.toLowerCase()})` : "";
                })()}</Label>
                <Input
                  id="p-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={pickQty}
                  onChange={(e) => setPickQty(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-cost">Costo{(() => {
                  const sel = products.find((x) => x.id === pickId);
                  return sel?.purchaseUnit ? ` por ${sel.purchaseUnit.toLowerCase()}` : " unitario";
                })()}</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="any"
                  value={pickCost}
                  onChange={(e) => setPickCost(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={addToCart} disabled={!pickId}>
                  <Plus className="mr-1.5 h-4 w-4" /> Agregar
                </Button>
              </div>
            </div>

            {cart.length > 0 && (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((l) => (
                      <TableRow key={l.productId}>
                        <TableCell className="max-w-48 truncate">
                          {l.name}
                          {conversionLabel(l) && (
                            <span className="block text-[10px] text-sky-700 dark:text-sky-400">
                              {conversionLabel(l)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {trimNum(l.quantity)} {unitLabel(l.purchaseUnit)}
                        </TableCell>
                        <TableCell>{formatMoney(l.unitCost, currency)}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(l.quantity * l.unitCost, currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            aria-label={`Quitar ${l.name}`}
                            onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))}
                          >
                            <MinusCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="p-note">Nota</Label>
              <Textarea
                id="p-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Condiciones, remisión del proveedor…"
              />
            </div>
            <p className="text-sm">
              Subtotal: <strong>{formatMoney(subtotal, currency)}</strong> · el IVA se calcula al crear la orden.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createOrder} disabled={saving}>
              <Package className="mr-1.5 h-4 w-4" />
              {saving ? "Creando…" : "Crear orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuevo proveedor desde la orden */}
      <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>
              Registra el proveedor que trae la mercancía. Después podrás agregar sus productos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="ns-name">Nombre / razón social *</Label>
              <Input
                id="ns-name"
                value={supForm.name}
                onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                placeholder="Distribuciones El Rosal S.A.S."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ns-tax">NIT / CC</Label>
                <Input
                  id="ns-tax"
                  value={supForm.taxId}
                  onChange={(e) => setSupForm({ ...supForm, taxId: e.target.value })}
                  placeholder="900.123.456-7"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ns-phone">Teléfono</Label>
                <Input
                  id="ns-phone"
                  value={supForm.phone}
                  onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                  placeholder="300 123 4567"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSupplierOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createSupplierInline} disabled={creatingSupplier}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              {creatingSupplier ? "Creando…" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuevo producto desde la orden (referencia nueva del proveedor) */}
      <Dialog open={newProdOpen} onOpenChange={setNewProdOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto thin-scroll sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>
              Registra la referencia nueva que trae el proveedor. Queda disponible de inmediato en el
              punto de venta y asociada a este proveedor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="np-name">Nombre *</Label>
              <Input
                id="np-name"
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                placeholder="Papel carta Display Xerox 75g"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="np-sku">SKU *</Label>
                <Input
                  id="np-sku"
                  value={prodForm.sku}
                  onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                  placeholder="PAP-001"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="np-cat">Categoría *</Label>
                <Input
                  id="np-cat"
                  list="np-cat-list"
                  value={prodForm.category}
                  onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                  placeholder="Papelería"
                />
                <datalist id="np-cat-list">
                  {Array.from(new Set(products.map((p) => p.category))).sort().map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="np-cost">Costo ({currency})</Label>
                <Input
                  id="np-cost"
                  type="number"
                  min={0}
                  value={prodForm.costPrice}
                  onChange={(e) => setProdForm({ ...prodForm, costPrice: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="np-price">Precio de venta ({currency})</Label>
                <Input
                  id="np-price"
                  type="number"
                  min={0}
                  value={prodForm.salePrice}
                  onChange={(e) => setProdForm({ ...prodForm, salePrice: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="np-stock">Stock actual</Label>
                <Input
                  id="np-stock"
                  type="number"
                  min={0}
                  value={prodForm.stock}
                  onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="np-min">Stock mínimo</Label>
                <Input
                  id="np-min"
                  type="number"
                  min={0}
                  value={prodForm.minStock}
                  onChange={(e) => setProdForm({ ...prodForm, minStock: e.target.value })}
                />
              </div>
            </div>
            {/* Conversión de unidades (opcional): comprar por presentación, vender por unidad mínima */}
            <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
              <div>
                <p className="text-sm font-medium">Conversión de unidades</p>
                <p className="text-xs text-muted-foreground">
                  Opcional. Compra en una presentación y vende en la unidad mínima:
                  resma→hojas, rollo→metros, caja→unidades. Déjelo vacío para vender tal como compra.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="np-sale-unit">Se vende por</Label>
                  <select
                    id="np-sale-unit"
                    value={prodForm.saleUnit}
                    onChange={(e) => setProdForm({ ...prodForm, saleUnit: e.target.value })}
                    aria-label="Unidad de venta"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none"
                  >
                    <option value="">— igual a la compra —</option>
                    {SALE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="np-buy-unit">Se compra en</Label>
                  <select
                    id="np-buy-unit"
                    value={prodForm.purchaseUnit}
                    onChange={(e) => setProdForm({ ...prodForm, purchaseUnit: e.target.value })}
                    aria-label="Unidad de compra"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none"
                  >
                    <option value="">— igual a la venta —</option>
                    {PURCHASE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="np-conv">Contenido</Label>
                  <Input
                    id="np-conv"
                    type="number"
                    min={0}
                    step="any"
                    value={prodForm.unitsPerPurchase}
                    onChange={(e) => setProdForm({ ...prodForm, unitsPerPurchase: e.target.value })}
                    placeholder="500"
                  />
                </div>
              </div>
              {(() => {
                const unitCfg = {
                  saleUnit: prodForm.saleUnit || null,
                  purchaseUnit: prodForm.purchaseUnit || null,
                  unitsPerPurchase: Number(prodForm.unitsPerPurchase.replace(",", ".")) || null,
                };
                const conv = conversionLabel(unitCfg);
                if (!conv) return null;
                return (
                  <p className="text-xs font-medium text-sky-700 dark:text-sky-400">{conv}</p>
                );
              })()}
            </div>
            <div className="grid gap-1.5">
              <Label>Proveedor del producto</Label>
              <Select value={prodSupplierId} onValueChange={setProdSupplierId}>
                <SelectTrigger aria-label="Proveedor del producto">
                  <SelectValue placeholder="Sin proveedor asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin proveedor —</SelectItem>
                  {suppliers
                    .filter((s) => s.active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Así aparecerá este producto en las órdenes de compra de este proveedor.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProdOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createProductInline} disabled={creatingProd}>
              <PackagePlus className="mr-1.5 h-4 w-4" />
              {creatingProd ? "Creando…" : "Crear y agregar a la orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmaciones */}
      <AlertDialog open={toReceive !== null} onOpenChange={(open) => !open && setToReceive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Recibir la compra {toReceive?.folio}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se aumentará el stock de cada producto, se registrarán los movimientos de entrada y se
              actualizará el costo de adquisición con el precio de esta compra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => toReceive && action(toReceive, "receive")}>
              Recibir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={toCancel !== null} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular la orden {toCancel?.folio}?</AlertDialogTitle>
            <AlertDialogDescription>
              La orden quedará anulada sin afectar el inventario. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toCancel && action(toCancel, "cancel")}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={toPay !== null} onOpenChange={(open) => !open && setToPay(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar el pago de {toPay?.folio}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrará un egreso por {toPay ? formatMoney(toPay.total, currency) : ""} en el módulo
              de finanzas y la compra quedará marcada como pagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => toPay && action(toPay, "pay")}>Registrar pago</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
