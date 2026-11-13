"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Blocks,
  Building2,
  CreditCard,
  Gauge,
  Hourglass,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Plug,
  Receipt,
  RefreshCw,
  Repeat,
  ScrollText,
  Settings,
  TicketPercent,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    label: "General",
    items: [
      { href: "/admin", label: "Dashboard SaaS", icon: LayoutDashboard },
      { href: "/admin/analitica", label: "Analítica", icon: TrendingUp },
    ],
  },
  {
    label: "Clientes del SaaS",
    items: [
      { href: "/admin/organizaciones", label: "Organizaciones", icon: Building2 },
      { href: "/admin/usuarios", label: "Usuarios", icon: UsersRound },
      { href: "/admin/soporte", label: "Soporte", icon: LifeBuoy },
    ],
  },
  {
    label: "Suscripciones",
    items: [
      { href: "/admin/suscripciones", label: "Suscripciones", icon: Repeat },
      { href: "/admin/planes", label: "Planes", icon: CreditCard },
      { href: "/admin/modulos", label: "Módulos", icon: Blocks },
      { href: "/admin/limites", label: "Límites", icon: Gauge },
      { href: "/admin/pruebas", label: "Pruebas gratuitas", icon: Hourglass },
      { href: "/admin/renovaciones", label: "Renovaciones", icon: RefreshCw },
      { href: "/admin/cancelaciones", label: "Cancelaciones", icon: Ban },
      { href: "/admin/morosidad", label: "Morosidad", icon: AlertTriangle },
      { href: "/admin/cupones", label: "Cupones", icon: TicketPercent },
    ],
  },
  {
    label: "Facturación del SaaS",
    items: [
      { href: "/admin/facturacion", label: "Facturación SaaS", icon: Receipt },
      { href: "/admin/pagos", label: "Pagos", icon: Wallet },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { href: "/admin/notificaciones", label: "Notificaciones", icon: Megaphone },
      { href: "/admin/integraciones", label: "Integraciones", icon: Plug },
      { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
      { href: "/admin/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="thin-scroll flex-1 overflow-y-auto px-3 pb-2" aria-label="Módulos del panel SaaS">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? "mt-4" : "mt-1"}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-violet-400/15 text-violet-200"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-[17px] w-[17px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
