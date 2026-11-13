"use client";

import { useEffect, useState } from "react";
import { KeyRound, Mail, Pencil, Plus, ShieldBan, Store, Trash2, UserRound } from "lucide-react";
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
import { useStoreSettings } from "../dashboard";
import type { AppUser } from "../types";
import { formatMoney } from "@/lib/format";

const ROLES = [
  { id: "ADMIN", label: "Administrador", desc: "Gestión completa de la operación diaria." },
  { id: "CAJERO", label: "Cajero", desc: "POS, apertura y cierre de caja." },
  { id: "VENDEDOR", label: "Vendedor", desc: "Clientes, cotizaciones y pedidos." },
  { id: "INVENTARIO", label: "Inventario", desc: "Entradas, salidas, ajustes y conteos." },
  { id: "COMPRAS", label: "Compras", desc: "Órdenes de compra y proveedores." },
  { id: "CONTADOR", label: "Contador", desc: "Finanzas, cartera y documentos." },
  { id: "LOGISTICA", label: "Logística", desc: "Despachos y entregas." },
  { id: "AUDITOR", label: "Auditor", desc: "Solo consulta de operaciones." },
];

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  ADMIN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CAJERO: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  VENDEDOR: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  INVENTARIO: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300",
  COMPRAS: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  CONTADOR: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  LOGISTICA: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  AUDITOR: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

const EMPTY = { id: "", name: "", email: "", role: "CAJERO", branch: "" };

export default function UsersModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AppUser | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setUsers(d.users ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  const save = async () => {
    if (!form.name.trim() || (!form.id && !form.email.trim())) {
      toast.error("El nombre y el correo son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = form.id !== "";
      const res = await fetch(isEdit ? `/api/users/${form.id}` : "/api/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          ...(isEdit ? {} : { email: form.email.trim().toLowerCase() }),
          role: form.role,
          branch: form.branch || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar el usuario.");
        return;
      }
      toast.success(isEdit ? "Usuario actualizado." : "Usuario creado.");
      setDialogOpen(false);
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: AppUser) => {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!res.ok) {
      toast.error("No se pudo cambiar el estado del usuario.");
      return;
    }
    toast.success(u.active ? `«${u.name}» quedó inactivo.` : `«${u.name}» quedó activo.`);
    notifyChange();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/users/${toDelete.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo eliminar el usuario.");
      return;
    }
    toast.success(`«${toDelete.name}» fue eliminado.`);
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
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Control de acceso por roles (RBAC). El rol <strong>OWNER</strong> no puede asignarse ni
            quitarse desde el panel: la propiedad de la organización tiene controles especiales.
          </p>
          <Button onClick={() => { setForm(EMPTY); setDialogOpen(true); }} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo usuario
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => (
          <Card key={u.id} className={`flex flex-col p-5 ${u.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {u.role === "OWNER" ? <ShieldBan className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{u.name}</p>
                  <Badge variant="outline" className={`mt-1 ${ROLE_BADGE[u.role] ?? ""}`}>
                    {u.role === "OWNER" ? "Propietario" : ROLES.find((r) => r.id === u.role)?.label ?? u.role}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label={`Editar ${u.name}`}
                  onClick={() => {
                    setForm({
                      id: u.id,
                      name: u.name,
                      email: u.email,
                      role: u.role,
                      branch: u.branch ?? "",
                    });
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {u.role !== "OWNER" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label={`Eliminar ${u.name}`}
                    onClick={() => setToDelete(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <dd className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{u.email}</span>
              </dd>
              <dd className="flex items-center gap-2">
                <Store className="h-3.5 w-3.5 shrink-0" />
                {u.branch || "Todas las sucursales"}
              </dd>
              <dd className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                {u.active ? "Acceso activo" : "Acceso suspendido"}
              </dd>
            </dl>

            {u.role !== "OWNER" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => toggleActive(u)}
              >
                {u.active ? "Suspender acceso" : "Reactivar acceso"}
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>
              Cada perfil define qué módulos y operaciones puede realizar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="u-name">Nombre completo *</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ana María Restrepo"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-email">Correo *</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                disabled={form.id !== ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@comercio.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger aria-label="Rol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-branch">Sucursal</Label>
                <Input
                  id="u-branch"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  placeholder="Principal (vacío = todas)"
                />
              </div>
            </div>
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {ROLES.find((r) => r.id === form.role)?.desc ??
                "Máxima autoridad: configuración de suscripción, usuarios y auditoría."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar al usuario {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderá el acceso al panel de forma definitiva. Esta acción no se puede deshacer.
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
