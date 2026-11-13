"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightCircle, FileText, MinusCircle, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Customer, Product, Quotation } from "../types";
import { formatMoney } from "@/lib/format";

type Line = { productId: string; name: string; sku: string; quantity: number; unitPrice: number };

const STATUS_BADGE: Record<string, string> = {
  borrador: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  enviada: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  aprobada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rechazada: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  convertida: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  convertida: "Convertida",
};

export default function QuotationsModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Quotation | null>(null);
  const [toConvert, setToConvert] = useState<Quotation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [validDays, setValidDays] = useState("15");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [pickId, setPickId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [pickPrice, setPickPrice] = useState("");

  const load = () => {
    Promise.all([
      fetch("/api/quotations?limit=200").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([q, c, p]) => {
        setQuotations(q.quotations ?? []);
        setCustomers(c.customers ?? []);
        setProducts(p.products ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotations;
    return quotations.filter(
      (x) =>
        x.folio.toLowerCase().includes(q) ||
        x.customerName.toLowerCase().includes(q) ||
        (x.items ?? []).some((i) => i.name.toLowerCase().includes(q))
    );
  }, [quotations, query]);

  const subtotal = cart.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const disc = Math.max(0, Number(discount) || 0);
  const taxRate = (settings?.taxRate ?? 19) / 100;
  const tax = Math.round((subtotal - disc) * taxRate);
  const total = subtotal - disc + tax;

  const addToCart = () => {
    const p = products.find((x) => x.id === pickId);
    if (!p) {
      toast.error("Selecciona un producto del catálogo.");
      return;
    }
    const qty = Math.max(1, Math.floor(Number(pickQty) || 1));
    const price = Number(pickPrice) > 0 ? Number(pickPrice) : p.wholesalePrice ?? p.salePrice;
    setCart((c) => [
      ...c.filter((l) => l.productId !== p.id),
      { productId: p.id, name: p.name, sku: p.sku, quantity: qty, unitPrice: price },
    ]);
    setPickId("");
    setPickQty("1");
    setPickPrice("");
  };

  const createQuotation = async () => {
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto a la cotización.");
      return;
    }
    setSaving(true);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + Math.max(1, Number(validDays) || 15));
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          items: cart,
          discount: disc,
          validUntil: validUntil.toISOString(),
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear la cotización.");
        return;
      }
      toast.success(`Cotización ${data.quotation.folio} creada.`);
      setDialogOpen(false);
      setCart([]);
      setDiscount("0");
      setNote("");
      setCustomerId("");
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (q: Quotation, status: string) => {
    const res = await fetch(`/api/quotations/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("No se pudo actualizar la cotización.");
      return;
    }
    toast.success(status === "enviada" ? "Cotización marcada como enviada." : `Estado: ${STATUS_LABEL[status]}.`);
    setDetail(null);
    notifyChange();
  };

  const convert = async (q: Quotation) => {
    const res = await fetch(`/api/quotations/${q.id}`, { method: "PUT" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo convertir la cotización.");
      return;
    }
    toast.success(`Cotización ${q.folio} convertida en la venta ${data.sale.folio}.`);
    setToConvert(null);
    setDetail(null);
    notifyChange();
  };

  const removeQuotation = async (q: Quotation) => {
    const res = await fetch(`/api/quotations/${q.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo eliminar la cotización.");
      return;
    }
    toast.success(`Cotización ${q.folio} eliminada.`);
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
              placeholder="Buscar por folio, cliente o producto…"
              className="pl-8"
              aria-label="Buscar cotizaciones"
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nueva cotización
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
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Vence</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No hay cotizaciones registradas.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer" onClick={() => setDetail(q)}>
                    <TableCell className="font-medium">{q.folio}</TableCell>
                    <TableCell className="max-w-48 truncate">{q.customerName}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString("es-CO") : "—"}
                    </TableCell>
                    <TableCell className="font-semibold">{formatMoney(q.total, currency)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[q.status]}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(q.status === "borrador" || q.status === "aprobada" || q.status === "enviada") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToConvert(q);
                          }}
                        >
                          <ArrowRightCircle className="mr-1 h-3.5 w-3.5" /> Vender
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detalle */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Cotización {detail.folio}
                </DialogTitle>
                <DialogDescription>
                  {detail.customerName} ·{" "}
                  {new Date(detail.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Precio</TableHead>
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
                      <TableCell>{formatMoney(it.unitPrice, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(it.subtotal, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(detail.subtotal, currency)}</span>
                </div>
                {detail.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descuento</span>
                    <span>− {formatMoney(detail.discount, currency)}</span>
                  </div>
                )}
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
                {detail.status === "borrador" && (
                  <Button variant="outline" onClick={() => setStatus(detail, "enviada")}>
                    <Send className="mr-1.5 h-4 w-4" /> Marcar enviada
                  </Button>
                )}
                {detail.status === "enviada" && (
                  <Button variant="outline" onClick={() => setStatus(detail, "aprobada")}>
                    Aprobar
                  </Button>
                )}
                {(detail.status === "borrador" || detail.status === "enviada" || detail.status === "aprobada") && (
                  <Button onClick={() => setToConvert(detail)}>
                    <ArrowRightCircle className="mr-1.5 h-4 w-4" /> Convertir en venta
                  </Button>
                )}
                {detail.status !== "convertida" && (
                  <Button
                    variant="destructive"
                    onClick={() => removeQuotation(detail)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nueva cotización */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto thin-scroll sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva cotización</DialogTitle>
            <DialogDescription>
              Ideal para mayoristas: envía precios por volumen y conviértela en venta cuando el cliente apruebe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Cliente</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger aria-label="Cliente">
                    <SelectValue placeholder="Cliente de mostrador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin cliente —</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="q-valid">Vigencia (días)</Label>
                <Input
                  id="q-valid"
                  type="number"
                  min="1"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Producto</Label>
                <Select
                  value={pickId}
                  onValueChange={(v) => {
                    setPickId(v);
                    const p = products.find((x) => x.id === v);
                    if (p) setPickPrice(String(p.wholesalePrice ?? p.salePrice));
                  }}
                >
                  <SelectTrigger aria-label="Producto">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {products
                      .filter((p) => p.active)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.sku}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="q-qty">Cantidad</Label>
                <Input
                  id="q-qty"
                  type="number"
                  min="1"
                  value={pickQty}
                  onChange={(e) => setPickQty(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={addToCart} disabled={!pickId}>
                  <Plus className="mr-1.5 h-4 w-4" /> Agregar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="q-price">Precio unit.</Label>
                <Input
                  id="q-price"
                  type="number"
                  min="0"
                  value={pickPrice}
                  onChange={(e) => setPickPrice(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="q-disc">Descuento</Label>
                <Input
                  id="q-disc"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>

            {cart.length > 0 && (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((l) => (
                      <TableRow key={l.productId}>
                        <TableCell className="max-w-40 truncate">{l.name}</TableCell>
                        <TableCell>{l.quantity}</TableCell>
                        <TableCell>{formatMoney(l.unitPrice, currency)}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(l.quantity * l.unitPrice, currency)}
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
              <Label htmlFor="q-note">Nota para el cliente</Label>
              <Input
                id="q-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tiempos de entrega, condiciones especiales…"
              />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(subtotal, currency)}</span>
              </div>
              {disc > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span>− {formatMoney(disc, currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span>{formatMoney(tax, currency)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-1 font-bold">
                <span>Total</span>
                <span>{formatMoney(total, currency)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createQuotation} disabled={saving}>
              {saving ? "Creando…" : "Crear cotización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toConvert !== null} onOpenChange={(open) => !open && setToConvert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Convertir {toConvert?.folio} en venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrará la venta por {toConvert ? formatMoney(toConvert.total, currency) : ""}, se
              descontará el stock y la cotización quedará como convertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => toConvert && convert(toConvert)}>Convertir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
