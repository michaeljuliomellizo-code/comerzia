import { redirect } from "next/navigation";
import Dashboard from "@/components/comerzia/dashboard";
import { requireOrgPage } from "@/lib/tenant";
import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { LogoWordmark } from "@/components/comerzia/logo";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const ctx = await requireOrgPage();

  // Organización suspendida: pantalla de bloqueo (no puede operar el comercio).
  if (!ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 text-sidebar-foreground">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="text-lg font-semibold text-white">Cuenta suspendida</h1>
          <p className="mt-2 text-sm text-sidebar-foreground/70">
            Tu organización está suspendida por morosidad. El panel del comercio está bloqueado
            hasta regularizar el pago de la suscripción.
          </p>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            Escribe a{" "}
            <span className="font-medium text-emerald-300">soporte@comerzia.com</span> para
            reactivar tu cuenta.
          </p>
          <form action={logoutAction} className="mt-6">
            <Button variant="outline" className="w-full border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Solo el super admin ve /panel vía soporte; un usuario normal pasa.
  if (ctx.profile.isSuperAdmin) redirect("/admin");

  return <Dashboard />;
}
