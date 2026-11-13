"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, TrendingUp, Receipt, Ticket, Percent } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreSettings } from "../dashboard";
import type { Sale } from "../types";
import { formatCompact, formatDate, formatMoney, formatNumber } from "@/lib/format";

const COLORS = ["#10b981", "#14b8a6", "#f59e0b", "#fb923c", "#059669", "#84cc16"];
const PERIODS = [
  { id: "7", label: "7 días" },
  { id: "30", label: "30 días" },
  { id: "all", label: "Todo el histórico" },
];

const PAY_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export default function ReportsModule({
  version,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

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

  const report = useMemo(() => {
    const valid = sales.filter((s) => s.status !== "cancelada");
    const days = period === "all" ? null : Number(period);
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    const inRange = cutoff
      ? valid.filter((s) => new Date(s.createdAt) >= cutoff)
      : valid;

    const revenue = inRange.filter((s) => s.status === "completada").reduce((a, s) => a + s.total, 0);
    const count = inRange.length;
    const avg = count ? revenue / count : 0;

    // Serie diaria
    const dayMap = new Map<string, number>();
    for (const s of inRange) {
      const key = s.createdAt.slice(0, 10);
      dayMap.set(key, (dayMap.get(key) ?? 0) + s.total);
    }
    const daily = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({
        date,
        revenue,
        label: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(
          new Date(`${date}T12:00:00`)
        ),
      }));

    // Top productos
    const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const s of inRange) {
      for (const it of s.items ?? []) {
        const cur = prodMap.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
        cur.qty += it.quantity;
        cur.revenue += it.subtotal;
        prodMap.set(it.name, cur);
      }
    }
    const top = Array.from(prodMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    // Métodos de pago
    const payMap = new Map<string, number>();
    for (const s of inRange) {
      if (s.status !== "completada") continue;
      payMap.set(s.paymentMethod, (payMap.get(s.paymentMethod) ?? 0) + s.total);
    }
    const payments = Array.from(payMap.entries()).map(([m, v]) => ({
      name: PAY_LABEL[m] ?? m,
      value: v,
    }));

    // Categorías por productId (aproximación por nombre → usamos items con sku)
    const catMap = new Map<string, number>();
    for (const s of inRange) {
      for (const it of s.items ?? []) {
        const prefix = (it.sku ?? "").split("-")[0];
        const cat = { BEB: "Bebidas", ABA: "Abarrotes", PAN: "Panadería", ASE: "Aseo", HOG: "Hogar" }[prefix];
        catMap.set(cat ?? "Otros", (catMap.get(cat ?? "Otros") ?? 0) + it.subtotal);
      }
    }
    const categories = Array.from(catMap.entries()).map(([c, v]) => ({ name: c, value: v }));

    // Impuestos estimados
    const tax = inRange.reduce((a, s) => a + s.tax, 0);
    const discount = inRange.reduce((a, s) => a + s.discount, 0);

    return { revenue, count, avg, daily, top, payments, categories, tax, discount, range: inRange };
  }, [sales, period]);

  const exportCsv = () => {
    const rows = [
      ["Folio", "Fecha", "Cliente", "Metodo de pago", "Subtotal", "Descuento", "IVA", "Total", "Estado"],
      ...report.range.map((s) => [
        s.folio,
        new Date(s.createdAt).toISOString(),
        s.customerName,
        s.paymentMethod,
        String(s.subtotal),
        String(s.discount),
        String(s.tax),
        String(s.total),
        s.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comerzia-reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reporte CSV descargado.");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const kpis = [
    {
      title: "Ingresos del periodo",
      value: formatMoney(report.revenue, currency),
      icon: TrendingUp,
      tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Ventas realizadas",
      value: formatNumber(report.count),
      icon: Receipt,
      tone: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    },
    {
      title: "Ticket promedio",
      value: formatMoney(report.avg, currency),
      icon: Ticket,
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    {
      title: "IVA recaudado",
      value: formatMoney(report.tax, currency),
      icon: Percent,
      tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={period === p.id ? "default" : "outline"}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((c) => (
          <Card key={c.title} className="p-5">
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold tracking-tight">{c.value}</p>
            <p className="text-sm font-medium text-foreground/80">{c.title}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolución de ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.daily} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(report.daily.length / 14) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v: number) => formatCompact(v, currency)}
                />
                <RTooltip
                  formatter={(v: number) => [formatMoney(v, currency), "Ingresos"]}
                  cursor={{ fill: "rgba(16,185,129,0.08)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {report.top.map((p, i) => {
                const max = report.top[0]?.revenue || 1;
                return (
                  <li key={p.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">
                        <Badge variant="outline" className="mr-2">{i + 1}</Badge>
                        {p.name}
                      </span>
                      <span className="shrink-0 font-semibold text-primary">
                        {formatMoney(p.revenue, currency)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                        style={{ width: `${Math.max(6, (p.revenue / max) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.qty} unidades vendidas</p>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribución por método de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52 text-muted-foreground">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.payments}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="52%"
                      outerRadius="78%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {report.payments.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(v: number) => formatMoney(v, currency)}
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ingresos por categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {report.categories
                  .sort((a, b) => b.value - a.value)
                  .map((c, i) => (
                    <li key={c.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{c.name}</span>
                      <span className="ml-auto font-medium">{formatMoney(c.value, currency)}</span>
                    </li>
                  ))}
                {report.categories.length === 0 && (
                  <li className="py-4 text-center text-muted-foreground">Sin datos en el periodo.</li>
                )}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Descuentos aplicados en el periodo: {formatMoney(report.discount, currency)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Datos calculados sobre {report.count} ventas ({formatDate(new Date())}). Exporta el CSV para
        compartirlas con tu contador.
      </p>
    </div>
  );
}
