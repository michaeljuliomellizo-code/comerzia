"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStoreSettings } from "../dashboard";
import type { Sale } from "../types";
import { formatDate, formatMoney } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  completada:
    "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300",
  pendiente: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300",
  cancelada: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
};

const PAY_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export default function SalesModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const [detail, setDetail] = useState<Sale | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sales?limit=200")
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          setSales(d.sales ?? []);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      const matchQ =
        !q ||
        s.folio.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        String(s.total).includes(q);
      const matchStatus =
        statusFilter === "todas" || (statusFilter === "finalizadas" ? s.status !== "cancelada" : s.status === statusFilter);
      return matchQ && matchStatus;
    });
  }, [sales, query, statusFilter]);

  const cancelSale = async (sale: Sale) => {
    const res = await fetch(`/api/sales/${sale.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelada" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo cancelar la venta.");
      return;
    }
    toast.success(`Venta ${sale.folio} cancelada. El stock fue devuelto al inventario.`);
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
              placeholder="Buscar por folio, cliente o total…"
              className="pl-8"
              aria-label="Buscar ventas"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los estados</SelectItem>
              <SelectItem value="completada">Completadas</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
              <SelectItem value="finalizadas">No canceladas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Folio</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Pago</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No hay ventas que coincidan con el filtro.
                    </td>
                  </tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{s.folio}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5">{s.customerName}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">{PAY_LABEL[s.paymentMethod] ?? s.paymentMethod}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {formatMoney(s.total, currency)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={STATUS_BADGE[s.status]}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setDetail(s)}
                          aria-label={`Ver detalle de ${s.folio}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {s.status !== "cancelada" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => cancelSale(s)}
                            aria-label={`Cancelar ${s.folio}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {filtered.length} de {sales.length} ventas mostradas · última actualización al cambiar de módulo.
          </p>
        </CardContent>
      </Card>

      {/* Detalle de venta */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Venta {detail.folio}
                  <Badge variant="outline" className={STATUS_BADGE[detail.status]}>
                    {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {formatDate(detail.createdAt)} · {PAY_LABEL[detail.paymentMethod] ?? detail.paymentMethod}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{detail.customerName}</p>
                {detail.note && <p className="mt-1 text-xs text-muted-foreground">Nota: {detail.note}</p>}
              </div>

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 text-center font-medium">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium">Precio</th>
                      <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(detail.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          <p className="max-w-[220px] truncate">{it.name}</p>
                          {it.sku && <p className="text-[11px] text-muted-foreground">{it.sku}</p>}
                        </td>
                        <td className="px-3 py-2 text-center">{it.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(it.unitPrice, currency)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatMoney(it.subtotal, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(detail.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento</span>
                  <span>−{formatMoney(detail.discount, currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA</span>
                  <span>{formatMoney(detail.tax, currency)}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatMoney(detail.total, currency)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
