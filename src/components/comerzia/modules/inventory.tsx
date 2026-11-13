"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, PackageSearch, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStoreSettings } from "../dashboard";
import type { Movement, Product } from "../types";
import { formatDate } from "@/lib/format";

const TYPE_META: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  entrada: {
    label: "Entrada",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    icon: ArrowDownToLine,
  },
  salida: {
    label: "Salida",
    cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    icon: ArrowUpFromLine,
  },
  ajuste: {
    label: "Ajuste",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    icon: SlidersHorizontal,
  },
};

export default function InventoryModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";

  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("entrada");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/movements?limit=80").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([m, p]) => {
        if (!alive) return;
        setMovements(m.movements ?? []);
        setProducts((p.products ?? []).sort((a: Product, b: Product) => a.name.localeCompare(b.name)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const submit = async () => {
    if (!productId) {
      toast.error("Selecciona un producto.");
      return;
    }
    if (Number(quantity) <= 0) {
      toast.error("La cantidad debe ser mayor que cero.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, type, quantity: Number(quantity), note: note.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo registrar el movimiento.");
        return;
      }
      toast.success("Movimiento registrado. El stock fue actualizado.");
      setQuantity("1");
      setNote("");
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const selected = products.find((p) => p.id === productId);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Formulario de movimiento */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrar movimiento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="inv-product">Producto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="inv-product">
                <SelectValue placeholder="Selecciona un producto…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Tipo de movimiento</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (compra / devolución)</SelectItem>
                <SelectItem value="salida">Salida (merma / consumo)</SelectItem>
                <SelectItem value="ajuste">Ajuste (fijar stock por conteo)</SelectItem>
              </SelectContent>
            </Select>
            {type === "ajuste" && selected && (
              <p className="text-xs text-muted-foreground">
                El stock quedará fijado exactamente en la cantidad indicada (actual: {selected.stock}).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-qty">Cantidad</Label>
              <Input
                id="inv-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid content-end">
              {selected && (
                <p className="text-xs text-muted-foreground">
                  Stock actual: <span className="font-semibold text-foreground">{selected.stock}</span> uds
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="inv-note">Nota (opcional)</Label>
            <Input
              id="inv-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej.: compra a proveedor X"
            />
          </div>

          <Button onClick={submit} disabled={saving || !productId}>
            {saving ? "Guardando…" : "Registrar movimiento"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Cada venta del POS genera automáticamente un movimiento de salida.
          </p>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Producto</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-center font-medium">Cantidad</th>
                  <th className="px-4 py-2.5 font-medium">Nota</th>
                  <th className="px-4 py-2.5 text-center font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Aún no hay movimientos registrados.
                    </td>
                  </tr>
                )}
                {movements.map((m) => {
                  const meta = TYPE_META[m.type];
                  return (
                    <tr key={m.id} className="hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="max-w-[200px] truncate">{m.product?.name ?? "—"}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{m.product?.sku}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={meta?.cls}>
                          {meta?.label ?? m.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold">
                        {m.type === "salida" ? "−" : m.type === "entrada" ? "+" : "→"} {m.quantity}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-2.5 text-muted-foreground">
                        {m.note ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1">
                          <PackageSearch className="h-3.5 w-3.5 text-muted-foreground" />
                          {m.product?.stock ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Últimos {movements.length} movimientos · el stock mostrado es el actual del producto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
