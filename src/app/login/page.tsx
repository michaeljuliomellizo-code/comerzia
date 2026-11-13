"use client";

import { useActionState } from "react";
import { Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoWordmark } from "@/components/comerzia/logo";
import { loginAction, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10 text-sidebar-foreground">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.18) 0%, rgba(8,17,13,0) 70%)",
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <LogoWordmark className="justify-center" dark />
          <p className="mt-3 text-sm text-sidebar-foreground/60">
            Gestión inteligente para el comercio moderno
          </p>
        </div>

        <div className="rounded-2xl border border-sidebar-border bg-sidebar/80 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-white">Iniciar sesión</h1>
              <p className="text-xs text-sidebar-foreground/55">
                Panel del negocio o administración del SaaS
              </p>
            </div>
          </div>

          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/40" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tucorreo@negocio.com"
                  className="border-sidebar-border bg-sidebar-accent/40 pl-9 text-sidebar-foreground placeholder:text-sidebar-foreground/35"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/40" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="border-sidebar-border bg-sidebar-accent/40 pl-9 text-sidebar-foreground placeholder:text-sidebar-foreground/35"
                />
              </div>
            </div>

            {state.error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-emerald-500 text-white hover:bg-emerald-400"
            >
              {pending ? "Verificando…" : "Entrar"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/45">
              Accesos de demostración
            </p>
            <ul className="space-y-1.5 text-xs text-sidebar-foreground/70">
              
              <li>
                <span className="font-medium text-emerald-300">Negocio demo:</span>{" "}
                demo@comerzia.com · demo123
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-sidebar-foreground/40">
          COMERZIA · Todo tu comercio en un solo lugar
        </p>
      </div>
    </div>
  );
}
