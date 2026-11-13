"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { Product } from "../types";
import { CATEGORY_BADGE } from "../types";
import { formatMoney } from "@/lib/format";

const EMPTY_FORM = {
  id: "",
  name: "",
  sku: "",
  category: "Bebidas",
  description: "",
  costPrice: "0",
  salePrice: "0",
  stock: "0",
  minStock: "5",
  active: true,
};

export default function ProductsModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  );

  useEffect(() => {
    let alive = true;
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          setProducts(d.products ?? []);
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
    return products.filter((p) => {
      const matchQ =
        !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCat = categoryFilter === "todas" || p.category === categoryFilter;
      return matchQ && matchCat;
    });
  }, [products, query, categoryFilter]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      description: p.description ?? "",
      costPrice: String(p.costPrice),
      salePrice: String(p.salePrice),
      stock: String(p.stock),
      minStock: String(p.minStock),
      active: p.active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.category.trim()) {
      toast.error("Nombre, SKU y categoría son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        costPrice: Number(form.costPrice) || 0,
        salePrice: Number(form.salePrice) || 0,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        active: form.active,
      };
      const isEdit = form.id !== "";
      const res = await fetch(isEdit ? `/api/products/${form.id}` : "/api/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar el producto.");
        return;
      }
      toast.success(isEdit ? "Producto actualizado." : "Producto creado.");
      setDialogOpen(false);
      notifyChange();
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/products/${toDelete.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "No se pudo eliminar el producto.");
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
      {/* Barra de acciones */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o SKU…"
              className="pl-8"
              aria-label="Buscar productos"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoría"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none"
          >
            <option value="todas">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Nuevo producto
          </Button>
        </CardContent>
      </Card>

      {/* Tabla de productos */}
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Producto</th>
                  <th className="px-4 py-2.5 font-medium">Categoría</th>
                  <th className="px-4 py-2.5 text-right font-medium">Costo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Precio</th>
                  <th className="px-4 py-2.5 text-right font-medium">Margen</th>
                  <th className="px-4 py-2.5 text-center font-medium">Stock</th>
                  <th className="px-4 py-2.5 text-center font-medium">Activo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No hay productos que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
                {filtered.map((p) => {
                  const margin =
                    p.salePrice > 0 ? Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100) : 0;
                  const low = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{p.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{p.sku}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={CATEGORY_BADGE[p.category] ?? "bg-muted text-muted-foreground"}>
                          {p.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {formatMoney(p.costPrice, currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatMoney(p.salePrice, currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={margin >= 30 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                          {margin}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={
                            p.stock === 0
                              ? "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                              : low
                                ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                                : ""
                          }
                        >
                          {p.stock} / mín {p.minStock}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center">
                          <Switch
                            checked={p.active}
                            onCheckedChange={async (checked) => {
                              await fetch(`/api/products/${p.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ active: checked }),
                              });
                              toast.success(checked ? "Producto activado." : "Producto desactivado.");
                              notifyChange();
                            }}
                            aria-label={`Activar ${p.name}`}
                          />
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(p)}
                            aria-label={`Editar ${p.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setToDelete(p)}
                            aria-label={`Eliminar ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {filtered.length} de {products.length} productos · el stock se actualiza con cada venta del POS.
          </p>
        </CardContent>
      </Card>

      {/* Diálogo crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              Los precios y el stock se reflejan de inmediato en el punto de venta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="p-name">Nombre *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Café premium molido 500g"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-sku">SKU *</Label>
                <Input
                  id="p-sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="BEB-001"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-cat">Categoría *</Label>
                <Input
                  id="p-cat"
                  list="cat-list"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Bebidas"
                />
                <datalist id="cat-list">
                  {["Bebidas", "Abarrotes", "Panadería", "Aseo", "Hogar"].map((c) => (
                    <option key={c} value={c} />
                  ))}
                  {categories.map((c) => (
                    <option key={`x-${c}`} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-cost">Costo ({currency})</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min={0}
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-price">Precio de venta ({currency})</Label>
                <Input
                  id="p-price"
                  type="number"
                  min={0}
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-stock">Stock actual</Label>
                <Input
                  id="p-stock"
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-min">Stock mínimo</Label>
                <Input
                  id="p-min"
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-desc">Descripción</Label>
              <Textarea
                id="p-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Notas internas sobre el producto…"
              />
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch
                id="p-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label htmlFor="p-active" className="cursor-pointer text-sm font-normal">
                Producto activo (visible en el punto de venta)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{toDelete?.name}» y su historial de movimientos de inventario. Esta
              acción no se puede deshacer.
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
