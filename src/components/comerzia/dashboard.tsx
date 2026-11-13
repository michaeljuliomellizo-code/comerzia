"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  BarChart3,
  ChevronRight,
  FileText,
  HandCoins,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Receipt,
  ReceiptText,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoMark } from "./logo";
import type { Settings } from "./types";
import { cn } from "@/lib/utils";

import OverviewModule from "./modules/overview";
import PosModule from "./modules/pos";
import CashModule from "./modules/cash";
import SalesModule from "./modules/sales";
import QuotationsModule from "./modules/quotations";
import ProductsModule from "./modules/products";
import InventoryModule from "./modules/inventory";
import PurchasesModule from "./modules/purchases";
import SuppliersModule from "./modules/suppliers";
import CustomersModule from "./modules/customers";
import MarketingModule from "./modules/marketing";
import FinanceModule from "./modules/finance";
import EinvoiceModule from "./modules/einvoice";
import ReportsModule from "./modules/reports";
import UsersModule from "./modules/users";
import SettingsModule from "./modules/settings";

type ModuleId =
  | "overview"
  | "pos"
  | "cash"
  | "sales"
  | "quotations"
  | "products"
  | "inventory"
  | "purchases"
  | "suppliers"
  | "customers"
  | "marketing"
  | "finance"
  | "einvoice"
  | "reports"
  | "users"
  | "settings";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ id: ModuleId; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    label: "Operación",
    items: [
      { id: "overview", label: "Resumen", icon: LayoutDashboard },
      { id: "pos", label: "Punto de venta", icon: ShoppingCart },
      { id: "cash", label: "Caja", icon: Banknote },
      { id: "sales", label: "Ventas", icon: Receipt },
      { id: "quotations", label: "Cotizaciones", icon: FileText },
    ],
  },
  {
    label: "Catálogo y suministro",
    items: [
      { id: "products", label: "Productos", icon: Package },
      { id: "inventory", label: "Inventario", icon: BarChart3 },
      { id: "purchases", label: "Compras", icon: Truck },
      { id: "suppliers", label: "Proveedores", icon: HandCoins },
    ],
  },
  {
    label: "Relaciones",
    items: [
      { id: "customers", label: "Clientes", icon: Users },
      { id: "marketing", label: "Marketing", icon: Tag },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { id: "finance", label: "Finanzas", icon: HandCoins },
      { id: "einvoice", label: "Facturación electrónica", icon: ReceiptText },
    ],
  },
  {
    label: "Gestión",
    items: [
      { id: "reports", label: "Reportes", icon: BarChart3 },
      { id: "users", label: "Usuarios", icon: UserRound },
      { id: "settings", label: "Ajustes", icon: SettingsIcon },
    ],
  },
];

const MODULE_TITLES: Record<ModuleId, string> = {
  overview: "Resumen",
  pos: "Punto de venta",
  cash: "Caja",
  sales: "Historial de ventas",
  quotations: "Cotizaciones y pedidos",
  products: "Productos",
  inventory: "Inventario",
  purchases: "Compras y abastecimiento",
  suppliers: "Proveedores",
  customers: "Clientes",
  marketing: "Marketing y fidelización",
  finance: "Finanzas y tesorería",
  einvoice: "Facturación electrónica",
  reports: "Reportes y analítica",
  users: "Usuarios y roles",
  settings: "Ajustes del comercio",
};

// Información de sesión multi-tenant (usuario, organización, plan y módulos)
type SessionInfo = {
  profile: { id: string; email: string; fullName: string | null; isSuperAdmin?: boolean; role?: string };
  organization: { id: string; name: string; slug: string; status: string; trialEndsAt: string | null; currency: string } | null;
  plan: { code: string; name: string; monthlyPrice: number } | null;
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  modules: string[];
};

// Contexto de configuración para los módulos
export const SettingsContext = createContext<{
  settings: Settings | null;
  refreshSettings: () => void;
}>({ settings: null, refreshSettings: () => {} });

export const useStoreSettings = () => useContext(SettingsContext);

export default function Dashboard() {
  const [module, setModule] = useState<ModuleId>("overview");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [version, setVersion] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Sesión multi-tenant: usuario, organización, plan y módulos habilitados
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unauthorized"))))
      .then((d: SessionInfo) => setSession(d))
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  // Hooks de configuración: deben ejecutarse en el mismo orden en cada render
  // (reglas de React) — antes de cualquier return condicional.
  const refreshSettings = useCallback(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const notifyChange = useCallback(() => setVersion((v) => v + 1), []);

  const navProps = { version, notifyChange: () => setVersion((v) => v + 1), onExit: () => {} };

  // Si la organización está suspendida, bloquear el panel completo
  if (session?.organization?.status === "suspendida") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 text-sidebar-foreground">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="text-lg font-semibold text-white">Cuenta suspendida</h1>
          <p className="mt-2 text-sm text-sidebar-foreground/70">
            Tu organización está suspendida por morosidad. Escribe a{" "}
            <span className="font-medium text-emerald-300">soporte@comerzia.com</span> para
            reactivarla.
          </p>
          <Button
            variant="outline"
            className="mt-6 w-full border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => {
              fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = "/login";
              });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  // Filtrado de navegación según los módulos habilitados por la plataforma
  const enabledCodes = session?.modules;
  const gating = Array.isArray(enabledCodes) && enabledCodes.length > 0;
  const visibleNavGroups: typeof NAV_GROUPS = gating
    ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => enabledCodes!.includes(i.id)) }))
        .filter((g) => g.items.length > 0)
    : NAV_GROUPS;

  const trialEndsAt = session?.organization?.trialEndsAt ? new Date(session.organization.trialEndsAt) : null;
  const daysToTrialEnd =
    trialEndsAt && session?.organization?.status === "prueba"
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
      : null;

  const renderModule = () => {
    switch (module) {
      case "overview":
        return <OverviewModule {...navProps} />;
      case "pos":
        return <PosModule {...navProps} />;
      case "cash":
        return <CashModule {...navProps} />;
      case "sales":
        return <SalesModule {...navProps} />;
      case "quotations":
        return <QuotationsModule {...navProps} />;
      case "products":
        return <ProductsModule {...navProps} />;
      case "inventory":
        return <InventoryModule {...navProps} />;
      case "purchases":
        return <PurchasesModule {...navProps} />;
      case "suppliers":
        return <SuppliersModule {...navProps} />;
      case "customers":
        return <CustomersModule {...navProps} />;
      case "marketing":
        return <MarketingModule {...navProps} />;
      case "finance":
        return <FinanceModule {...navProps} />;
      case "einvoice":
        return <EinvoiceModule {...navProps} />;
      case "reports":
        return <ReportsModule {...navProps} />;
      case "users":
        return <UsersModule {...navProps} />;
      case "settings":
        return <SettingsModule {...navProps} />;
    }
  };

  const navButton = (item: { id: ModuleId; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const active = module === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          setModule(item.id);
          setNavOpen(false);
        }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          active
            ? "bg-sidebar-primary/15 text-emerald-300"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-[17px] w-[17px] shrink-0" />
        <span className="truncate">{item.label}</span>
        {active && <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-70" />}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <LogoMark />
        <div>
          <p className="text-base font-extrabold leading-none text-white">
            COMER<span className="text-emerald-400">ZIA</span>
          </p>
          <p className="mt-1 text-[11px] leading-none text-sidebar-foreground/50">
            Gestión inteligente
          </p>
        </div>
      </div>

      <nav className="thin-scroll flex-1 overflow-y-auto px-3 pb-2" aria-label="Módulos del panel">
        {visibleNavGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-4" : "mt-1"}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </p>
            <div className="space-y-0.5">{group.items.map(navButton)}</div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border/40 px-3 py-3">
        {daysToTrialEnd !== null && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-300">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            Prueba gratis: {daysToTrialEnd === 0 ? "termina hoy" : `${daysToTrialEnd} día${daysToTrialEnd === 1 ? "" : "s"} restantes`}
          </div>
        )}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-emerald-300">
            <Store className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {session?.organization?.name ?? settings?.storeName ?? "Mi comercio"}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/50">
              {session?.subscription?.status === "prueba"
                ? "Período de prueba"
                : session?.plan
                  ? `Plan ${session.plan.name}`
                  : "Sin plan asignado"}
              {session?.profile?.email ? ` · ${session.profile.email}` : ""}
            </p>
          </div>
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
        </div>
        <div className="mt-1 flex gap-1">
          <Button
            variant="ghost"
            asChild
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
            size="sm"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al sitio
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cerrar sesión"
            className="justify-start text-sidebar-foreground/60 hover:text-red-300 hover:text-sidebar-foreground"
            onClick={() => {
              fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = "/login";
              });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings }}>
      <div className="flex min-h-screen bg-background">
        {/* Barra lateral fija en escritorio */}
        <aside
          className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block"
          aria-label="Barra lateral"
        >
          {sidebarContent}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Encabezado */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
            {/* Menú móvil */}
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                  </svg>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground [&>button]:text-white">
                <SheetHeader className="sr-only">
                  <SheetTitle>Módulos</SheetTitle>
                </SheetHeader>
                {sidebarContent}
              </SheetContent>
            </Sheet>

            <h1 className="truncate text-base font-semibold sm:text-lg">{MODULE_TITLES[module]}</h1>
            {module === "overview" && settings && (
              <Badge variant="outline" className="hidden bg-primary/10 text-primary sm:inline-flex">
                {settings.storeName}
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Cambiar tema"
              >
                <Sun className="h-5 w-5 dark:hidden" />
                <Moon className="hidden h-5 w-5 dark:block" />
              </Button>
            </div>
          </header>

          {/* Contenido del módulo */}
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {settings === null ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-72 rounded-xl" />
              </div>
            ) : (
              renderModule()
            )}
          </main>
        </div>
      </div>
    </SettingsContext.Provider>
  );
}
