"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  LayoutDashboard,
  LineChart,
  PackageCheck,
  Receipt,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoWordmark } from "./logo";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

const FEATURES = [
  {
    icon: Zap,
    title: "Ventas rápidas",
    desc: "Registra ventas en segundos con el punto de venta integrado y cobra en efectivo, tarjeta o transferencia.",
  },
  {
    icon: Boxes,
    title: "Inventario en tiempo real",
    desc: "El stock se descuenta con cada venta y te avisa cuando un producto llega a su mínimo.",
  },
  {
    icon: Users,
    title: "Clientes y fidelización",
    desc: "Conoce el historial de compras de cada cliente, sea particular o empresa, y reconoce a tus mejores compradores.",
  },
  {
    icon: BarChart3,
    title: "Reportes inteligentes",
    desc: "Ingresos por día, categorías, métodos de pago y productos más vendidos, siempre listos para decidir.",
  },
  {
    icon: Smartphone,
    title: "Multi-dispositivo",
    desc: "Administra tu negocio desde el celular, la tablet o el computador con la misma velocidad.",
  },
  {
    icon: ShieldCheck,
    title: "Datos bajo control",
    desc: "Toda la información de tu comercio vive en tu propia base de datos, lista para respaldar y crecer.",
  },
];

const MODULES = [
  {
    icon: Receipt,
    name: "Punto de venta",
    desc: "Arma el carrito, aplica descuentos, elige el método de pago y genera folios automáticamente.",
    tag: "Cobra en segundos",
  },
  {
    icon: PackageCheck,
    name: "Inventario",
    desc: "Entradas, salidas y ajustes con historial completo. Cada movimiento queda registrado y trazable.",
    tag: "Nunca te quedes sin stock",
  },
  {
    icon: ScanBarcode,
    name: "Catálogo de productos",
    desc: "Precios, costos, márgenes y categorías claras para todo tu catálogo, con búsqueda instantánea.",
    tag: "Catálogo siempre ordenado",
  },
  {
    icon: LineChart,
    name: "Analítica",
    desc: "KPIs del día y del mes, crecimiento contra el periodo anterior y alertas de stock bajo.",
    tag: "Decisiones con datos",
  },
];

const PLANS = [
  {
    name: "Básico",
    price: "$89.900",
    period: "/mes",
    desc: "Para pequeños comercios que están comenzando.",
    features: [
      "Dashboard básico + punto de venta",
      "Facturación electrónica incluida",
      "Productos y categorías (1.000)",
      "Inventario de una bodega",
      "Compras básicas + proveedores",
      "1 sucursal · 3 usuarios",
      "Soporte por correo",
    ],
    highlight: false,
  },
  {
    name: "Profesional",
    price: "$149.900",
    period: "/mes",
    desc: "Para negocios en crecimiento con más volumen y personal.",
    features: [
      "Todo lo del plan Básico, más:",
      "Hasta 5 sucursales y 10 bodegas",
      "Cotizaciones y pedidos",
      "Listas de precios mayoristas",
      "Caja con arqueo + Finanzas y cartera",
      "Marketing, cupones y comisiones",
      "Reportes avanzados · 15 usuarios",
      "Soporte prioritario",
    ],
    highlight: true,
  },
  {
    name: "Premium",
    price: "$229.900",
    period: "/mes",
    desc: "Para distribuidores y empresas con operación compleja.",
    features: [
      "Todo lo del Profesional, más:",
      "Tienda virtual propia + portal de clientes",
      "Logística: picking, packing y despachos",
      "Inteligencia de negocios y pronósticos",
      "Automatización de compras",
      "API completa y webhooks",
      "Usuarios y sucursales ampliados",
      "Soporte dedicado 24/7",
    ],
    highlight: false,
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-[#08110D] text-white">
      {/* Barra de navegación */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08110D]/85 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Navegación principal">
          <LogoWordmark dark />
          <div className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            <a href="#producto" className="transition hover:text-white">Producto</a>
            <a href="#modulos" className="transition hover:text-white">Módulos</a>
            <a href="#precios" className="transition hover:text-white">Precios</a>
          </div>
          <Button
            asChild
            className="bg-primary text-primary-foreground shadow-lg shadow-emerald-900/40 hover:bg-primary/90"
          >
            <Link href="/panel">
              Abrir el panel
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.18) 0%, rgba(8,17,13,0) 70%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mx-auto max-w-3xl text-center"
            >
              <Badge
                variant="outline"
                className="mb-6 gap-1.5 rounded-full border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-emerald-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Gestión inteligente para el comercio moderno
              </Badge>
              <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                Todo tu comercio en{" "}
                <span className="text-brand-gradient">un solo lugar</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
                COMERZIA centraliza ventas, inventario, clientes y reportes de tu negocio en una
                sola plataforma. Deja de administrar hojas de cálculo y sistemas desconectados:
                controla todo desde un panel, en tiempo real.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  asChild
                  className="h-12 bg-primary px-6 text-base font-semibold shadow-xl shadow-emerald-900/50 hover:bg-primary/90"
                >
                  <Link href="/panel">
                    Abrir el panel <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/20 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white"
                  onClick={() =>
                    document.querySelector("#modulos")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Ver módulos
                </Button>
              </div>
            </motion.div>

            {/* Mockup del panel */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative mx-auto mt-14 max-w-4xl"
            >
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl shadow-black/60 backdrop-blur">
                <div className="rounded-xl bg-[#0D1B15] p-5 sm:p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <LayoutDashboard className="h-4 w-4 text-emerald-400" />
                      Panel del día
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                      En vivo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Ventas de hoy", value: "$1.48M", icon: Wallet },
                      { label: "Ticket promedio", value: "$48.3K", icon: Receipt },
                      { label: "Productos", value: "24", icon: Boxes },
                      { label: "Clientes", value: "12", icon: Users },
                    ].map((k) => (
                      <div
                        key={k.label}
                        className="rounded-lg border border-white/10 bg-white/5 p-4"
                      >
                        <k.icon className="mb-2 h-4 w-4 text-emerald-400" />
                        <p className="text-xl font-bold">{k.value}</p>
                        <p className="mt-0.5 text-xs text-white/55">{k.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Mini gráfico decorativo */}
                  <div className="mt-5 flex h-24 items-end gap-1.5 sm:h-28">
                    {[35, 55, 42, 68, 50, 78, 62, 88, 71, 95, 80, 100, 86, 92].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-emerald-600/50 to-emerald-400"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Chips flotantes */}
              <div className="absolute -left-3 top-10 hidden rounded-xl border border-white/10 bg-[#0D1B15] px-4 py-3 shadow-xl md:block">
                <p className="text-xs text-white/55">Stock bajo</p>
                <p className="text-sm font-semibold text-amber-300">2 productos por reponer</p>
              </div>
              <div className="absolute -right-3 bottom-8 hidden rounded-xl border border-white/10 bg-[#0D1B15] px-4 py-3 shadow-xl md:block">
                <p className="text-xs text-white/55">Crecimiento 30 días</p>
                <p className="text-sm font-semibold text-emerald-300">+18.4% vs. periodo anterior</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Beneficios en cifras */}
        <section className="border-y border-white/10 bg-white/[0.03] px-4 py-10 sm:px-6">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 text-center md:grid-cols-4">
            {[
              { big: "+32%", small: "ventas por ticket más alto" },
              { big: "-60%", small: "tiempo en inventarios" },
              { big: "1 lugar", small: "todo tu comercio centralizado" },
              { big: "24/7", small: "acceso desde cualquier dispositivo" },
            ].map((s) => (
              <div key={s.big}>
                <p className="text-3xl font-extrabold text-brand-gradient">{s.big}</p>
                <p className="mt-1 text-sm text-white/55">{s.small}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Producto / características */}
        <section id="producto" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Diseñado para operar el negocio completo
              </h2>
              <p className="mt-4 text-white/60">
                Cada módulo de COMERZIA resuelve una parte del día a día: vender, reponer, atender
                y analizar. Todos conectados entre sí, sin duplicar trabajo.
              </p>
            </motion.div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <motion.div
                  key={f.title}
                  {...fadeUp}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-emerald-400/40 hover:bg-white/[0.07]"
                >
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Módulos */}
        <section id="modulos" className="scroll-mt-20 border-t border-white/10 bg-white/[0.02] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <motion.div {...fadeUp} className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Cuatro módulos, un solo sistema
              </h2>
              <p className="mt-4 text-white/60">
                Lo que vendes actualiza el inventario. Lo que inventarias alimenta las alertas.
                Lo que compras construye el historial del cliente. Todo fluye sin integraciones.
              </p>
            </motion.div>
            <div className="mt-10 space-y-4">
              {MODULES.map((m, i) => (
                <motion.div
                  key={m.name}
                  {...fadeUp}
                  className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-6 sm:flex-row sm:items-center"
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 text-emerald-300">
                    <m.icon className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {String(i + 1).padStart(2, "0")} · {m.name}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">{m.desc}</p>
                  </div>
                  <Badge className="shrink-0 self-start rounded-full bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/15 sm:self-center">
                    {m.tag}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Precios */}
        <section id="precios" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Planes para cada etapa del negocio
              </h2>
              <p className="mt-4 text-white/60">
                Empieza gratis y crece a tu ritmo. Sin costos ocultos ni permanencia mínima.
              </p>
            </motion.div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANS.map((p) => (
                <motion.div
                  key={p.name}
                  {...fadeUp}
                  className={
                    p.highlight
                      ? "relative rounded-2xl border-2 border-emerald-400/60 bg-white/[0.06] p-7 shadow-2xl shadow-emerald-900/30"
                      : "rounded-2xl border border-white/10 bg-white/[0.04] p-7"
                  }
                >
                  {p.highlight && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 text-primary-foreground">
                      El más elegido
                    </Badge>
                  )}
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="mt-1 text-sm text-white/55">{p.desc}</p>
                  <p className="mt-5">
                    <span className="text-4xl font-extrabold">{p.price}</span>
                    <span className="text-sm text-white/50">{p.period}</span>
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-white/70">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={p.highlight ? "default" : "outline"}
                    className={
                      p.highlight
                        ? "mt-7 w-full bg-primary hover:bg-primary/90"
                        : "mt-7 w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    }
                  >
                    <Link href="/panel">Probar ahora</Link>
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-24 pt-4 sm:px-6">
          <motion.div
            {...fadeUp}
            className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-600/25 via-emerald-700/10 to-transparent p-10 text-center sm:p-14"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Empieza hoy con COMERZIA
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/65">
              El panel de gestión ya viene cargado con datos de demostración para que explores
              ventas, inventario, clientes y reportes desde el primer minuto.
            </p>
            <Button
              size="lg"
              asChild
              className="mt-8 h-12 bg-primary px-8 text-base font-semibold shadow-xl shadow-emerald-900/50 hover:bg-primary/90"
            >
              <Link href="/panel">
                Abrir el panel <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Pie pegado al fondo */}
      <footer className="mt-auto border-t border-white/10 bg-[#060D0A] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <LogoWordmark dark />
          <p className="text-sm text-white/45">
            © {new Date().getFullYear()} COMERZIA · Gestión inteligente para el comercio moderno
          </p>
        </div>
      </footer>
    </div>
  );
}
