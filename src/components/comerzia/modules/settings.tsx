"use client";

import { useEffect, useState } from "react";
import { Save, Store } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useStoreSettings } from "../dashboard";
import { formatMoney } from "@/lib/format";

export default function SettingsModule({
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings, refreshSettings } = useStoreSettings();
  const [form, setForm] = useState({
    storeName: "",
    currency: "COP",
    taxRate: "19",
    lowStockWarn: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName,
        currency: settings.currency,
        taxRate: String(settings.taxRate),
        lowStockWarn: settings.lowStockWarn,
      });
    }
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: form.storeName.trim() || "Mi Comercio",
          currency: form.currency,
          taxRate: Number(form.taxRate) || 0,
          lowStockWarn: form.lowStockWarn,
        }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar la configuración.");
        return;
      }
      refreshSettings();
      notifyChange();
      toast.success("Configuración guardada. Los módulos usarán estos valores.");
    } finally {
      setSaving(false);
    }
  };

  const previewValue = 250000;
  const previewMoney = formatMoney(
    previewValue,
    form.currency
  );

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-[18px] w-[18px] text-primary" />
            Datos del comercio
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="s-name">Nombre del comercio</Label>
            <Input
              id="s-name"
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              placeholder="Mi Comercio"
            />
            <p className="text-xs text-muted-foreground">
              Se muestra en el menú lateral y en los reportes exportados.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="s-currency">Moneda</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm({ ...form, currency: v })}
              >
                <SelectTrigger id="s-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">Peso colombiano (COP)</SelectItem>
                  <SelectItem value="MXN">Peso mexicano (MXN)</SelectItem>
                  <SelectItem value="USD">Dólar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-tax">IVA (%)</Label>
              <Input
                id="s-tax"
                type="number"
                min={0}
                max={50}
                value={form.taxRate}
                onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Se aplica al registrar nuevas ventas.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Alertas de stock bajo</p>
              <p className="text-xs text-muted-foreground">
                Resalta productos que llegan a su stock mínimo.
              </p>
            </div>
            <Switch
              checked={form.lowStockWarn}
              onCheckedChange={(v) => setForm({ ...form, lowStockWarn: v })}
              aria-label="Activar alertas de stock bajo"
            />
          </div>

          <Separator />

          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium">Vista previa de formato</p>
            <p className="mt-1 text-muted-foreground">
              Una venta de {formatMoney(previewValue, form.currency)} con IVA del{" "}
              {form.taxRate || 0}% quedaría en{" "}
              <span className="font-semibold text-primary">
                {formatMoney(Math.round(previewValue * (1 + (Number(form.taxRate) || 0) / 100)), form.currency)}
              </span>
              .
            </p>
          </div>

          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Guardando…" : "Guardar configuración"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Acerca de COMERZIA</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>
            COMERZIA es una plataforma de gestión para el comercio moderno: punto de venta,
            inventario con trazabilidad, clientes con historial y reportes automáticos. Todo tu
            comercio en un solo lugar.
          </p>
          <p className="mt-2">
            Este panel viene cargado con datos de demostración (24 productos, 12 clientes y ventas
            de los últimos 45 días) para que explores todas las funciones.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
