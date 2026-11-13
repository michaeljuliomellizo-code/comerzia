"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Minus,
  Plus,
  ScanSearch,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useStoreSettings } from "../dashboard";
import type { Customer, Product, Sale } from "../types";
import { CATEGORY_BADGE } from "../types";
import { formatMoney } from "@/lib/format";

type CartLine = { product: Product; qty: number };

export default function PosModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const taxRate = settings?.taxRate ?? 19;

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("mostrador");
  const [payment, setPayment] = useState("efectivo");
  const [discount, setDiscount] = useState("0");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/products?active=1")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => toast.error("No se pudo cargar el catálogo."));
  }, [version]);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, query]);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        if (existing.qty >= p.stock) {
          toast.warning(`Solo hay ${p.stock} unidades de "${p.name}".`);
          return prev;
        }
        return prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      if (p.stock <= 0) {
        toast.warning(`"${p.name}" está sin stock.`);
        return prev;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== id) return l;
          const next = l.qty + delta;
          if (next > l.product.stock) {
            toast.warning(`Solo hay ${l.product.stock} unidades de "${l.product.name}".`);
            return l;
          }
          return { ...l, qty: next };
        })
        .filter((l) => l.qty > 0)
    );
  };

  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  const subtotal = cart.reduce((a, l) => a + l.product.salePrice * l.qty, 0);
  const disc = Math.max(0, Number(discount) || 0);
  const couponDisc = coupon?.discount ?? 0;
  const taxable = Math.max(0, subtotal - disc - couponDisc);
  const tax = Math.round(taxable * (taxRate / 100));
  const total = taxable + tax;

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (subtotal <= 0) {
      toast.warning("Agrega productos al carrito antes de aplicar un cupón.");
      return;
    }
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Cupón no válido.");
      return;
    }
    setCoupon({ code, discount: data.discount });
    toast.success(`Cupón ${code} aplicado: −${formatMoney(data.discount, currency)}.`);
    setCouponInput("");
  };

  const removeCoupon = () => {
    setCoupon(null);
  };

  const submitSale = async () => {
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto al carrito.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId === "mostrador" ? null : customerId,
          items: cart.map((l) => ({ productId: l.product.id, quantity: l.qty })),
          paymentMethod: payment,
          discount: disc,
          couponCode: coupon?.code ?? null,
          status: "completada",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo registrar la venta.");
        return;
      }
      const sale: Sale = data.sale;
      toast.success(`Venta ${sale.folio} registrada por ${formatMoney(sale.total, currency)}.`);
      setCart([]);
      setDiscount("0");
      setCoupon(null);
      setCouponInput("");
      setCustomerId("mostrador");
      notifyChange();
    } catch {
      toast.error("Error de conexión al registrar la venta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Catálogo */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Catálogo</CardTitle>
            <div className="relative w-full sm:w-64">
              <ScanSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto, SKU o categoría…"
                className="pl-8"
                aria-label="Buscar productos"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid max-h-[520px] gap-3 overflow-y-auto thin-scroll pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                No se encontraron productos con «{query}».
              </p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className="group rounded-xl border p-3.5 text-left transition hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={`Agregar ${p.name} al carrito`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{p.name}</p>
                  <Badge
                    variant="outline"
                    className={
                      p.stock <= p.minStock
                        ? "shrink-0 border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                        : "shrink-0"
                    }
                  >
                    {p.stock}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-base font-bold text-primary">
                    {formatMoney(p.salePrice, currency)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{p.sku}</span>
                </div>
                <div className="mt-2">
                  <Badge className={`text-[11px] ${CATEGORY_BADGE[p.category] ?? "bg-muted text-muted-foreground"}`}>
                    {p.category}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Carrito y cobro */}
      <Card className="lg:col-span-2 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-[18px] w-[18px] text-primary" />
            Carrito ({cart.reduce((a, l) => a + l.qty, 0)} artículos)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="max-h-56 space-y-2 overflow-y-auto thin-scroll pr-1">
            {cart.length === 0 && (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                Haz clic en un producto del catálogo para agregarlo.
              </div>
            )}
            {cart.map((l) => (
              <div key={l.product.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(l.product.salePrice, currency)} × {l.qty}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => changeQty(l.product.id, -1)}
                    aria-label="Quitar una unidad"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => changeQty(l.product.id, 1)}
                    aria-label="Agregar una unidad"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="w-24 text-right text-sm font-semibold">
                  {formatMoney(l.product.salePrice * l.qty, currency)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeLine(l.product.id)}
                  aria-label="Eliminar del carrito"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pos-customer">Cliente</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="pos-customer">
                  <SelectValue placeholder="Cliente de mostrador" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="mostrador">Cliente de mostrador</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pos-payment">Método de pago</Label>
                <Select value={payment} onValueChange={setPayment}>
                  <SelectTrigger id="pos-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pos-discount">Descuento ({currency})</Label>
                <Input
                  id="pos-discount"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pos-coupon">Cupón de descuento</Label>
              {coupon ? (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-mono font-semibold text-primary">
                    <BadgePercent className="h-4 w-4" /> {coupon.code}
                    <span className="font-sans font-normal text-muted-foreground">
                      −{formatMoney(coupon.discount, currency)}
                    </span>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={removeCoupon}
                    aria-label="Quitar cupón"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="pos-coupon"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="BIENVENIDA10"
                    className="font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={applyCoupon} disabled={!couponInput.trim()}>
                    Aplicar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Descuento</span>
              <span>−{formatMoney(disc, currency)}</span>
            </div>
            {coupon && (
              <div className="flex justify-between text-primary">
                <span>Cupón {coupon.code}</span>
                <span>−{formatMoney(couponDisc, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>IVA ({taxRate}%)</span>
              <span>{formatMoney(tax, currency)}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-extrabold text-primary">
                {formatMoney(total, currency)}
              </span>
            </div>
          </div>

          <Button
            size="lg"
            className="mt-auto h-12 text-base font-semibold"
            onClick={submitSale}
            disabled={saving || cart.length === 0}
          >
            <Wallet className="mr-2 h-5 w-5" />
            {saving ? "Procesando…" : "Cobrar venta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
