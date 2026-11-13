"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Pencil, Plus, Power, Search, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Coupon } from "../types";
import { formatMoney } from "@/lib/format";

const EMPTY = { id: "", code: "", type: "porcentaje", value: "", minTotal: "", expiresAt: "" };

export default function MarketingModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Coupon | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/coupons")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setCoupons(d.coupons ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const filtered = coupons.filter(
    (c) => !query.trim() || c.code.toLowerCase().includes(query.trim().toLowerCase())
  );

  const save = async () => {
    if (!form.code.trim()) {
      toast.error("El código del cupón es obligatorio.");
      return;
    }
    if (!Number(form.value)) {
      toast.error("El valor del cupón debe ser mayor a cero.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = form.id !== "";
      const res = await fetch(isEdit ? `/api/coupons/${form.id}` : "/api/coupons", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? {} : { code: form.code.trim().toUpperCase() }),
          type: form.type,
          value: Number(form.value),
          minTotal: Number(form.minTotal) || 0,
          expiresAt: form.expiresAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar el cupón.");
        return;
      }
      toast.success(isEdit ? "Cupón actualizado." : "Cupón creado.");
      setDialogOpen(false);
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Coupon) => {
    const res = await fetch(`/api/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    if (!res.ok) {
      toast.error("No se pudo cambiar el estado del cupón.");
      return;
    }
    toast.success(c.active ? `Cupón ${c.code} desactivado.` : `Cupón ${c.code} activado.`);
    notifyChange();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/coupons/${toDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("No se pudo eliminar el cupón.");
      return;
    }
    toast.success(`Cupón ${toDelete.code} eliminado.`);
    setToDelete(null);
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
              placeholder="Buscar cupón por código…"
              className="pl-8"
              aria-label="Buscar cupones"
            />
          </div>
          <Button onClick={() => { setForm(EMPTY); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo cupón
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead className="hidden sm:table-cell">Mínimo</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay cupones. Crea el primero para activar promociones en el POS.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => {
                  const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 font-mono font-semibold">
                          <Tag className="h-3.5 w-3.5 text-primary" /> {c.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.type === "porcentaje"
                          ? `${c.value} %`
                          : formatMoney(c.value, currency)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {c.minTotal > 0 ? formatMoney(c.minTotal, currency) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("es-CO") : "Sin vencimiento"}
                      </TableCell>
                      <TableCell>{c.usageCount}</TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="outline" className="bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            Vencido
                          </Badge>
                        ) : c.active ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`${c.active ? "Desactivar" : "Activar"} ${c.code}`}
                            onClick={() => toggle(c)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Editar ${c.code}`}
                            onClick={() => {
                              setForm({
                                id: c.id,
                                code: c.code,
                                type: c.type,
                                value: String(c.value),
                                minTotal: String(c.minTotal),
                                expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
                              });
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label={`Eliminar ${c.code}`}
                            onClick={() => setToDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 pt-4 text-sm text-muted-foreground">
          <BadgePercent className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Los cupones activos se pueden aplicar en el <strong>punto de venta</strong> digitando el código.
            La validación (vencimiento y mínimo de compra) se hace en el servidor antes de registrar la venta.
          </p>
        </CardContent>
      </Card>

      {/* Crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar cupón" : "Nuevo cupón"}</DialogTitle>
            <DialogDescription>
              El código se convierte a mayúsculas y debe ser único.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="cp-code">Código *</Label>
              <Input
                id="cp-code"
                value={form.code}
                disabled={form.id !== ""}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="BIENVENIDA10"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger aria-label="Tipo de cupón">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="porcentaje">Porcentaje (%)</SelectItem>
                    <SelectItem value="monto">Monto fijo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-value">{form.type === "porcentaje" ? "Porcentaje" : "Valor"} *</Label>
                <Input
                  id="cp-value"
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-min">Subtotal mínimo</Label>
                <Input
                  id="cp-min"
                  type="number"
                  min="0"
                  value={form.minTotal}
                  onChange={(e) => setForm({ ...form, minTotal: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-exp">Vence</Label>
                <Input
                  id="cp-exp"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear cupón"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el cupón {toDelete?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no podrá aplicarse en nuevas ventas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
