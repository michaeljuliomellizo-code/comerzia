"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Mail, MapPin, IdCard, Pencil, Phone, Plus, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { useStoreSettings } from "../dashboard";
import type { Customer, Sale } from "../types";
import { formatMoney } from "@/lib/format";

const EMPTY_FORM = {
  id: "",
  name: "",
  email: "",
  phone: "",
  docId: "",
  type: "particular",
  address: "",
  notes: "",
};

export default function CustomersModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/sales?limit=200").then((r) => r.json()),
    ])
      .then(([c, s]) => {
        if (!alive) return;
        setCustomers(c.customers ?? []);
        setSales(s.sales ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const statsByCustomer = useMemo(() => {
    const map = new Map<string, { purchases: number; revenue: number; last: string | null }>();
    for (const s of sales) {
      if (!s.customerId || s.status === "cancelada") continue;
      const cur = map.get(s.customerId) ?? { purchases: 0, revenue: 0, last: null };
      cur.purchases += 1;
      cur.revenue += s.total;
      if (!cur.last || new Date(s.createdAt) > new Date(cur.last)) cur.last = s.createdAt;
      map.set(s.customerId, cur);
    }
    return map;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
    );
  }, [customers, query]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setForm({
      id: c.id,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      docId: c.docId ?? "",
      type: c.type,
      address: c.address ?? "",
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = form.id !== "";
      const res = await fetch(isEdit ? `/api/customers/${form.id}` : "/api/customers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar el cliente.");
        return;
      }
      toast.success(isEdit ? "Cliente actualizado." : "Cliente creado.");
      setDialogOpen(false);
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/customers/${toDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("No se pudo eliminar el cliente.");
      return;
    }
    toast.success(`"${toDelete.name}" fue eliminado.`);
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
              placeholder="Buscar por nombre, correo o teléfono…"
              className="pl-8"
              aria-label="Buscar clientes"
            />
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo cliente
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No hay clientes que coincidan con «{query}».
            </CardContent>
          </Card>
        )}
        {filtered.map((c) => {
          const st = statsByCustomer.get(c.id);
          return (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {c.type === "empresa" ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <UserRound className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <Badge
                      variant="outline"
                      className="mt-1"
                    >
                      {c.type === "empresa" ? "Empresa" : "Particular"}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEdit(c)}
                    aria-label={`Editar ${c.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setToDelete(c)}
                    aria-label={`Eliminar ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <dl className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {c.email && (
                  <dd className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.email}</span>
                  </dd>
                )}
                {c.phone && (
                  <dd className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone}
                  </dd>
                )}
                {c.docId && (
                  <dd className="flex items-center gap-2">
                    <IdCard className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.docId}</span>
                  </dd>
                )}
                {c.address && (
                  <dd className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.address}</span>
                  </dd>
                )}
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-center">
                <div>
                  <p className="text-lg font-bold">{st?.purchases ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground">compras</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{formatMoney(st?.revenue ?? 0, currency)}</p>
                  <p className="text-[11px] text-muted-foreground">histórico</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Diálogo crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            <DialogDescription>
              Los datos del cliente se usan para las ventas del POS y el historial de compras.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="c-name">Nombre / Razón social *</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Restaurante La Esquina"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo de cliente</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.type === "particular" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, type: "particular" })}
                >
                  Particular
                </Button>
                <Button
                  type="button"
                  variant={form.type === "empresa" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm({ ...form, type: "empresa" })}
                >
                  Empresa
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="c-doc">Documento / NIT</Label>
                <Input
                  id="c-doc"
                  value={form.docId}
                  onChange={(e) => setForm({ ...form, docId: e.target.value })}
                  placeholder="CC o NIT"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="c-phone">Teléfono</Label>
                <Input
                  id="c-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="310 000 0000"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-email">Correo</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="cliente@correo.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-address">Dirección</Label>
              <Input
                id="c-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Cra. 45 #23-18"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-notes">Notas</Label>
              <Textarea
                id="c-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Preferencias, condiciones de pago…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{toDelete?.name}». Sus ventas anteriores se conservarán como ventas de
              mostrador. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
