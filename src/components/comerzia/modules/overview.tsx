"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
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
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  HandCoins,
  PackageCheck,
  PiggyBank,
  Receipt,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreSettings } from "../dashboard";
import type { Metrics } from "../types";
import { formatCompact, formatDate, formatDayLabel, formatMoney, formatNumber } from "@/lib/format";

const C1 = "#10b981";
const C2 = "#14b8a6";
const C3 = "#f59e0b";
const C4 = "#059669";
const C5 = "#fb923c";
const PIE_COLORS = [C1, C2, C3, C5, C4, "#84cc16"];

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-popover-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-popover-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {formatter ? formatter(Number(p.value)) : formatNumber(Number(p.value))}
        </p>
      ))}
    </div>
  );
}

const PAY_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  credito: "Crédito",
};

export default function OverviewModule({ version }: { version: number }) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((d: Metrics) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [version]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const k = data.kpis;
  const kpiCards = [
    {
      title: "Ventas de hoy",
      value: formatMoney(k.revenueToday, currency),
      sub: `${formatNumber(k.salesToday)} transacciones`,
      icon: Wallet,
      tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      extra: null as React.ReactNode,
    },
    {
      title: "Ingresos del mes",
      value: formatMoney(k.revenueMonth, currency),
      sub: `Últimos 30 días: ${formatCompact(k.revenue30, currency)}`,
      icon: TrendingUp,
      tone: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
      extra: null as React.ReactNode,
    },
    {
      title: "Ticket promedio",
      value: formatMoney(k.avgTicket, currency),
      sub: "Promedio últimos 30 días",
      icon: Ticket,
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      extra:
        k.growth !== null ? (
          <Badge
            className={
              k.growth >= 0
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            }
          >
            {k.growth >= 0 ? (
              <ArrowUpRight className="mr-0.5 h-3 w-3" />
            ) : (
              <ArrowDownRight className="mr-0.5 h-3 w-3" />
            )}
            {Math.abs(k.growth)}%
          </Badge>
        ) : null,
    },
    {
      title: "Clientes registrados",
      value: formatNumber(k.totalCustomers),
      sub: `${formatNumber(k.totalProducts)} productos en catálogo`,
      icon: Users,
      tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
      extra: null as React.ReactNode,
    },
  ];

  const series = data.dailySeries.map((d) => ({
    ...d,
    label: formatDayLabel(d.date),
  }));

  const pieData = data.paymentMethods.map((p) => ({
    name: PAY_LABEL[p.method] ?? p.method,
    value: p.revenue,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section aria-label="Indicadores clave">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((c) => (
            <Card key={c.title} className="p-5">
              <div className="flex items-start justify-between">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.tone}`}>
                  <c.icon className="h-5 w-5" />
                </span>
                {c.extra}
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight">{c.value}</p>
              <p className="text-sm font-medium text-foreground/80">{c.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* KPIs ERP */}
      <section aria-label="Indicadores operativos">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Compras del mes",
              value: formatMoney(k.purchasesMonth, currency),
              sub: `${formatNumber(k.itemsSoldMonth)} unidades vendidas este mes`,
              icon: Truck,
              tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
            },
            {
              title: "Cuentas por cobrar",
              value: formatMoney(k.arBalance, currency),
              sub: "Ventas a crédito pendientes",
              icon: PiggyBank,
              tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            },
            {
              title: "Cuentas por pagar",
              value: formatMoney(k.apTotal, currency),
              sub: "Compras recibidas sin pagar",
              icon: PackageCheck,
              tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
            },
            {
              title: "Valor del inventario",
              value: formatMoney(k.inventoryValue, currency),
              sub: `${formatNumber(k.inventoryUnits)} unidades · ${formatNumber(k.outOfStock)} agotados`,
              icon: Boxes,
              tone: "bg-lime-500/15 text-lime-600 dark:text-lime-400",
            },
          ].map((c) => (
            <Card key={c.title} className="p-5">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.tone}`}>
                <c.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-2xl font-bold tracking-tight">{c.value}</p>
              <p className="text-sm font-medium text-foreground/80">{c.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Gráfico principal + pago */}
      <section className="grid gap-4 lg:grid-cols-3" aria-label="Ingresos y métodos de pago">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ingresos de los últimos 30 días</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 text-muted-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C1} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={(v: number) => formatCompact(v, currency)}
                  />
                  <RTooltip content={<ChartTooltip formatter={(v) => formatMoney(v, currency)} />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={C1}
                    strokeWidth={2.5}
                    fill="url(#gradRev)"
                    name="Ingresos"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Métodos de pago (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 text-muted-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip content={<ChartTooltip formatter={(v) => formatMoney(v, currency)} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {pieData.map((p, i) => (
                <li key={p.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-foreground/80">{p.name}</span>
                  <span className="ml-auto font-medium">{formatCompact(p.value, currency)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Categorías + bajo stock */}
      <section className="grid gap-4 lg:grid-cols-3" aria-label="Categorías y alertas">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas por categoría (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 text-muted-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.categoryRevenue}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatCompact(v, currency)}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={90}
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RTooltip
                    content={<ChartTooltip formatter={(v) => formatMoney(v, currency)} />}
                    cursor={{ fill: "rgba(16,185,129,0.08)" }}
                  />
                  <Bar dataKey="revenue" fill={C2} radius={[0, 6, 6, 0]} barSize={20} name="Ingresos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Alertas de stock</CardTitle>
            {k.lowStockCount > 0 && (
              <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> {k.lowStockCount}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {data.lowStockProducts.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Boxes className="h-8 w-8 text-emerald-500/60" />
                Todo el inventario está por encima del mínimo.
              </div>
            ) : (
              <ul className="max-h-64 space-y-2.5 overflow-y-auto thin-scroll">
                {data.lowStockProducts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        p.stock === 0
                          ? "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                          : "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                      }
                    >
                      {p.stock} / mín {p.minStock}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Últimas ventas */}
      <section aria-label="Últimas ventas">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimas ventas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Folio</th>
                    <th className="px-4 py-2.5 font-medium">Cliente</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Total</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.recentSales.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-mono text-xs">{s.folio}</td>
                      <td className="max-w-[180px] truncate px-4 py-2.5">{s.customerName}</td>
                      <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                        {formatDate(s.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold">{formatMoney(s.total, currency)}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            s.status === "completada"
                              ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                              : s.status === "pendiente"
                                ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                                : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                          }
                        >
                          {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              {formatNumber(k.pendingSales)} ventas pendientes de cobro · {formatNumber(k.salesToday)} ventas hoy
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
