"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Banknote, DoorOpen, History, Lock, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoreSettings } from "../dashboard";
import type { CashSession } from "../types";
import { formatMoney } from "@/lib/format";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

export default function CashModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [open, setOpen] = useState<CashSession | null>(null);
  const [closed, setClosed] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"none" | "open" | "movement" | "close">("none");
  const [saving, setSaving] = useState(false);

  const [openingAmount, setOpeningAmount] = useState("200000");
  const [openedBy, setOpenedBy] = useState("");
  const [mvType, setMvType] = useState("ingreso");
  const [mvAmount, setMvAmount] = useState("");
  const [mvConcept, setMvConcept] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const load = () => {
    fetch("/api/cash")
      .then((r) => r.json())
      .then((d) => {
        setOpen(d.open ?? null);
        setClosed(d.closed ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [version]);

  const cashIn = useMemo(
    () => (open?.movements ?? []).filter((m) => m.type === "ingreso").reduce((a, m) => a + m.amount, 0),
    [open]
  );
  const cashOut = useMemo(
    () => (open?.movements ?? []).filter((m) => m.type === "egreso").reduce((a, m) => a + m.amount, 0),
    [open]
  );
  const expected = (open?.openingAmount ?? 0) + cashIn - cashOut;

  const submit = async () => {
    setSaving(true);
    try {
      let payload;
      if (dialog === "open") {
        payload = { action: "open", openingAmount: Number(openingAmount) || 0, openedBy };
      } else if (dialog === "movement") {
        payload = { action: "movement", type: mvType, amount: Number(mvAmount) || 0, concept: mvConcept };
      } else {
        payload = { action: "close", closingAmount: Number(closingAmount) || 0, notes: closeNotes };
      }
      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo completar la operación.");
        return;
      }
      if (dialog === "open") toast.success("Caja abierta. Las ventas en efectivo se registrarán aquí.");
      if (dialog === "movement") toast.success("Movimiento de caja registrado.");
      if (dialog === "close") {
        const d = data.session?.difference ?? 0;
        toast.success(
          d === 0
            ? "Caja cerrada sin diferencias. ¡Cuadró perfecto!"
            : `Caja cerrada con diferencia de ${formatMoney(d, currency)}.`
        );
      }
      setDialog("none");
      setMvAmount("");
      setMvConcept("");
      setClosingAmount("");
      setCloseNotes("");
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {open ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Movimientos de la sesión abierta */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="h-5 w-5 text-emerald-500" /> Caja abierta
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDialog("movement")}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Movimiento
                </Button>
                <Button size="sm" onClick={() => { setClosingAmount(String(expected)); setDialog("close"); }}>
                  <Lock className="mr-1 h-3.5 w-3.5" /> Cerrar caja
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Base inicial</p>
                  <p className="mt-1 font-bold">{formatMoney(open.openingAmount, currency)}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-3">
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                  <p className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(cashIn, currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-rose-500/10 p-3">
                  <p className="text-xs text-muted-foreground">Egresos</p>
                  <p className="mt-1 font-bold text-rose-600 dark:text-rose-400">
                    {formatMoney(cashOut, currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-xs text-muted-foreground">Efectivo esperado</p>
                  <p className="mt-1 font-bold">{formatMoney(expected, currency)}</p>
                </div>
              </div>

              <Separator className="my-4" />
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Abierta por {open.openedBy} · {fmtDateTime(open.openedAt)}
              </p>
              <ScrollArea className="max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="hidden sm:table-cell">Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(open.movements ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          Aún no hay movimientos. Las ventas en efectivo aparecerán aquí automáticamente.
                        </TableCell>
                      </TableRow>
                    )}
                    {(open.movements ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <p className="font-medium">{m.concept}</p>
                          {m.source === "venta" && (
                            <Badge variant="outline" className="mt-0.5 text-[10px]">
                              automático
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.type === "ingreso" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <ArrowDownLeft className="h-3.5 w-3.5" /> Ingreso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                              <ArrowUpRight className="h-3.5 w-3.5" /> Egreso
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${m.type === "ingreso" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {m.type === "ingreso" ? "+" : "−"} {formatMoney(m.amount, currency)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {new Date(m.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Arqueo rápido */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Arqueo de cierre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base inicial</span>
                <span>{formatMoney(open.openingAmount, currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>+ Ingresos en efectivo</span>
                <span>{formatMoney(cashIn, currency)}</span>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>− Egresos</span>
                <span>{formatMoney(cashOut, currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Efectivo esperado en cajón</span>
                <span>{formatMoney(expected, currency)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Al cerrar, compara el conteo físico con el monto esperado y el sistema calcula la
                diferencia automáticamente.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <DoorOpen className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">No hay una caja abierta</p>
              <p className="text-sm text-muted-foreground">
                Abre la caja con una base inicial para empezar a registrar ventas en efectivo.
              </p>
            </div>
            <Button onClick={() => setDialog("open")}>
              <DoorOpen className="mr-1.5 h-4 w-4" /> Abrir caja
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Historial de sesiones */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-muted-foreground" /> Historial de cierres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Contado</TableHead>
                  <TableHead>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Aún no hay sesiones cerradas.
                    </TableCell>
                  </TableRow>
                )}
                {closed.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{fmtDateTime(s.openedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.closedAt ? fmtDateTime(s.closedAt) : "—"}
                    </TableCell>
                    <TableCell>{s.openedBy}</TableCell>
                    <TableCell>{formatMoney(s.expectedAmount ?? 0, currency)}</TableCell>
                    <TableCell>{formatMoney(s.closingAmount ?? 0, currency)}</TableCell>
                    <TableCell>
                      {(s.difference ?? 0) === 0 ? (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Sin diferencias
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={(s.difference ?? 0) > 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"}
                        >
                          {(s.difference ?? 0) > 0 ? "Sobrante " : "Faltante "}
                          {formatMoney(Math.abs(s.difference ?? 0), currency)}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo abrir caja */}
      <Dialog open={dialog === "open"} onOpenChange={(o) => !o && setDialog("none")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDescription>
              Define la base inicial en efectivo y el cajero responsable del turno.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="cash-open">Base inicial</Label>
              <Input
                id="cash-open"
                type="number"
                min="0"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cash-user">Cajero</Label>
              <Input
                id="cash-user"
                value={openedBy}
                onChange={(e) => setOpenedBy(e.target.value)}
                placeholder="Nombre del cajero"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Abriendo…" : "Abrir caja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo movimiento manual */}
      <Dialog open={dialog === "movement"} onOpenChange={(o) => !o && setDialog("none")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Movimiento de caja</DialogTitle>
            <DialogDescription>
              Registra ingresos o egresos en efectivo que no provienen de una venta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={mvType} onValueChange={setMvType}>
                <SelectTrigger aria-label="Tipo de movimiento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso (base, cobros…)</SelectItem>
                  <SelectItem value="egreso">Egreso (gastos menores…)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cash-amount">Monto</Label>
              <Input
                id="cash-amount"
                type="number"
                min="1"
                value={mvAmount}
                onChange={(e) => setMvAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cash-concept">Concepto</Label>
              <Input
                id="cash-concept"
                value={mvConcept}
                onChange={(e) => setMvConcept(e.target.value)}
                placeholder="Ej: domicilios, propinas, compra de insumos…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Registrando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo cierre de caja */}
      <Dialog open={dialog === "close"} onOpenChange={(o) => !o && setDialog("none")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
            <DialogDescription>
              Ingresa el efectivo contado físicamente en el cajón para calcular la diferencia.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              Efectivo esperado: <strong>{formatMoney(expected, currency)}</strong>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cash-closing">Efectivo contado</Label>
              <Input
                id="cash-closing"
                type="number"
                min="0"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
              />
              {closingAmount !== "" && Number(closingAmount) !== expected && (
                <p className={`text-xs ${Number(closingAmount) > expected ? "text-emerald-600" : "text-rose-600"}`}>
                  Diferencia: {formatMoney(Number(closingAmount) - expected, currency)}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cash-notes">Observaciones</Label>
              <Input
                id="cash-notes"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Explica la diferencia, si la hay…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Cerrando…" : "Cerrar caja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
