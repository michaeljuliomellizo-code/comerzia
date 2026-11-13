import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { requireSuperAdminPage } from "@/lib/tenant";
import { logoutAction } from "@/app/login/actions";
import { AdminNav } from "@/components/admin/nav";
import { LogoWordmark } from "@/components/comerzia/logo";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdminPage();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <LogoWordmark dark />
      </div>
      <div className="mx-4 mb-2 rounded-lg border border-violet-400/25 bg-violet-400/10 px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-300">
          Panel del SaaS
        </p>
        <p className="mt-0.5 text-[10px] leading-tight text-sidebar-foreground/55">
          Administración de la plataforma COMERZIA
        </p>
      </div>

      <AdminNav />

      <div className="border-t border-sidebar-border/40 px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-400/20 text-violet-200">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {admin.fullName ?? "Super Admin"}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/50">{admin.email}</p>
          </div>
        </div>
        <div className="mt-1 flex gap-1">
          <Button
            variant="ghost"
            asChild
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <Link href="/">
              Sitio público
            </Link>
          </Button>
          <form action={logoutAction}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              aria-label="Cerrar sesión"
              className="text-sidebar-foreground/60 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block"
        aria-label="Barra lateral del panel SaaS"
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <p className="text-base font-semibold sm:text-lg">
            COMER<span className="text-violet-500 dark:text-violet-400">ZIA</span> · Administración
          </p>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            {/* En móvil la barra lateral se pliega: enlaces rápidos */}
            <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
              Inicio
            </Link>
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>

        {/* Navegación horizontal en móvil */}
        <div className="border-b bg-sidebar px-2 py-1.5 lg:hidden">
          <div className="thin-scroll flex gap-1 overflow-x-auto">
            {[
              "/admin",
              "/admin/organizaciones",
              "/admin/suscripciones",
              "/admin/facturacion",
              "/admin/pagos",
              "/admin/soporte",
              "/admin/analitica",
            ].map((href) => (
              <Link
                key={href}
                href={href}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                {href === "/admin"
                  ? "Dashboard"
                  : href.split("/").pop()?.charAt(0).toUpperCase() + href.split("/").pop()!.slice(1)}
              </Link>
            ))}
          </div>
        </div>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
