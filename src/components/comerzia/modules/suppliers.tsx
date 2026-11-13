"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, IdCard } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Supplier } from "../types";

const EMPTY_FORM = {
  id: "",
  name: "",
  taxId: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "contado",
  notes: "",
};

const TERMS_LABEL: Record<string, string> = {
  contado: "Contado",
  credito_15: "Crédito 15 días",
  credito_30: "Crédito 30 días",
};

export default function SuppliersModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSuppliers(d.suppliers ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.taxId ?? "").toLowerCase().includes(q) ||
        (s.contactName ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre del proveedor es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = form.id !== "";
      const res = await fetch(isEdit ? `/api/suppliers/${form.id}` : "/api/suppliers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar el proveedor.");
        return;
      }
      toast.success(isEdit ? "Proveedor actualizado." : "Proveedor creado.");
      setDialogOpen(false);
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/suppliers/${toDelete.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo eliminar el proveedor.");
      return;
    }
    toast.success(data.message ?? `"${toDelete.name}" fue eliminado.`);
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
              placeholder="Buscar por nombre, NIT o contacto…"
              className="pl-8"
              aria-label="Buscar proveedores"
            />
          </div>
          <Button onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo proveedor
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No hay proveedores que coincidan con «{query}».
            </CardContent>
          </Card>
        )}
        {filtered.map((s) => (
          <Card key={s.id} className={`flex flex-col p-5 ${s.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.name}</p>
                  <Badge variant="outline" className="mt-1">
                    {TERMS_LABEL[s.paymentTerms] ?? s.paymentTerms}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label={`Editar ${s.name}`}
                  onClick={() => {
                    setForm({
                      id: s.id,
                      name: s.name,
                      taxId: s.taxId ?? "",
                      contactName: s.contactName ?? "",
                      email: s.email ?? "",
                      phone: s.phone ?? "",
                      address: s.address ?? "",
                      paymentTerms: s.paymentTerms,
                      notes: s.notes ?? "",
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
                  aria-label={`Eliminar ${s.name}`}
                  onClick={() => setToDelete(s)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {s.taxId && (
                <dd className="flex items-center gap-2">
                  <IdCard className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{s.taxId}</span>
                </dd>
              )}
              {s.contactName && <dd>Contacto: {s.contactName}</dd>}
              {s.email && (
                <dd className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{s.email}</span>
                </dd>
              )}
              {s.phone && (
                <dd className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {s.phone}
                </dd>
              )}
              {s.address && (
                <dd className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{s.address}</span>
                </dd>
              )}
            </dl>

            {!s.active && (
              <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Inactivo — tiene historial de compras asociado.
              </p>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
            <DialogDescription>
              Los proveedores alimentan el módulo de compras y las cuentas por pagar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="s-name">Nombre / Razón social *</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Distribuidora Andina S.A.S."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-tax">NIT</Label>
                <Input
                  id="s-tax"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="900.000.000-1"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-contact">Contacto comercial</Label>
                <Input
                  id="s-contact"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="Nombre del asesor"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-email">Correo</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ventas@proveedor.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-phone">Teléfono</Label>
                <Input
                  id="s-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="601 000 0000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-address">Dirección</Label>
                <Input
                  id="s-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Calle industrial #00-00"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Condiciones de pago</Label>
                <Select
                  value={form.paymentTerms}
                  onValueChange={(v) => setForm({ ...form, paymentTerms: v })}
                >
                  <SelectTrigger aria-label="Condiciones de pago">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">Contado</SelectItem>
                    <SelectItem value="credito_15">Crédito 15 días</SelectItem>
                    <SelectItem value="credito_30">Crédito 30 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-notes">Notas</Label>
              <Textarea
                id="s-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Productos que suministra, acuerdos…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{toDelete?.name}». Si tiene compras asociadas, solo se desactivará para
              conservar el historial.
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
