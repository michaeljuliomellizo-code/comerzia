// Componentes de interfaz compartidos del panel administrativo del SaaS
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function AdminCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function AdminStatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "warning" | "info";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-sky-600 dark:text-sky-400",
  };
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums", tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  activa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  activo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  pagada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  confirmado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  resuelto: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  efectiva: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  enviada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  prueba: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  pendiente: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  programada: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  abierto: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  vencida: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  suspendida: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  suspendido: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  urgente: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  alta: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  cancelada: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  cerrado: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  cerrada: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  revertida: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  rechazado: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  anulada: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
};

export function AdminBadge({ tone, children }: { tone: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        BADGE_TONES[tone?.toLowerCase()] ?? "bg-muted text-muted-foreground border-muted"
      )}
    >
      {children ?? tone}
    </span>
  );
}

export function AdminTable({
  head,
  children,
  empty,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
      {empty && <p className="py-8 text-center text-sm text-muted-foreground">Sin registros todavía.</p>}
    </div>
  );
}

export function AdminTd({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-middle", className)}>{children}</td>;
}

export function AdminTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 font-medium", className)}>{children}</th>;
}

// Estilos compartidos para los controles de formulario en las páginas admin
export const adminField =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const adminLabel = "text-xs font-medium text-muted-foreground";

export function AdminFlash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return (
    <div
      role="status"
      className={cn(
        "mb-4 rounded-lg border px-4 py-2.5 text-sm",
        err
          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      )}
    >
      {err ?? msg}
    </div>
  );
}

export function AdminLinkButton({
  href,
  children,
  variant = "outline",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "outline" | "primary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center rounded-md px-3.5 text-sm font-medium transition",
        variant === "primary"
          ? "bg-emerald-600 text-white shadow hover:bg-emerald-500"
          : "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </Link>
  );
}

// Barra simple de comparación (límites / crecimiento) sin librerías de gráficos
export function AdminMiniBar({ pct, tone = "emerald" }: { pct: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", tones[tone] ?? tones.emerald)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
