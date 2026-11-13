"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HandCoins, PackageCheck, PiggyBank, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStoreSettings } from "../dashboard";
import type { FinanceTransaction } from "../types";
import { formatMoney } from "@/lib/format";

interface FinanceData {
  transactions: FinanceTransaction[];
  accountsReceivable: Array<{
    id: string;
    folio: string;
    customerName: string;
    total: number;
    paid: number;
    balance: number;
    createdAt: string;
  }>;
  accountsPayable: Array<{
    id: string;
    folio: string;
    supplierName: string;
    total: number;
    createdAt: string;
  }>;
  kpis: {
    arTotal: number;
    arCount: number;
    apTotal: number;
    apCount: number;
    expensesMonth: number;
    otherIncomeMonth: number;
    purchasesMonth: number;
  };
}

export default function FinanceModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [data, setData] = useState<FinanceData | null>(null);
  const [dialog, setDialog] = useState<"none" | "movement" | "abono">("none");
  const [saving, setSaving] = useState(false);
  const [abonoTarget, setAbonoTarget] = useState<{ id: string; folio: string; balance: number } | null>(null);

  const [type, setType] = useState("egreso");
  const [category, setCategory] = useState("operativo");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [description, setDescription] = useState("");
  const [abonoAmount, setAbonoAmount] = useState("");
  const [abonoMethod, setAbonoMethod] = useState("efectivo");

  const load = () => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [version]);

  const submitMovement = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          category,
          amount: Number(amount) || 0,
          method,
          description,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "No se pudo registrar el movimiento.");
        return;
      }
      toast.success(type === "ingreso" ? "Ingreso registrado." : "Egreso registrado.");
      setDialog("none");
      setAmount("");
      setDescription("");
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  const submitAbono = async () => {
    if (!abonoTarget) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "abono",
          saleId: abonoTarget.id,
          amount: Number(abonoAmount) || 0,
          method: abonoMethod,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "No se pudo registrar el abono.");
        return;
      }
      toast.success(`Abono a ${abonoTarget.folio} registrado.`);
      setDialog("none");
      setAbonoAmount("");
      setAbonoTarget(null);
      notifyChange();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cuentas por cobrar</CardTitle>
            <PiggyBank className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(data.kpis.arTotal, currency)}</p>
            <p className="text-xs text-muted-foreground">{data.kpis.arCount} ventas a crédito pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cuentas por pagar</CardTitle>
            <PackageCheck className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(data.kpis.apTotal, currency)}</p>
            <p className="text-xs text-muted-foreground">{data.kpis.apCount} compras recibidas sin pagar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Egresos del mes</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(data.kpis.expensesMonth, currency)}</p>
            <p className="text-xs text-muted-foreground">
              Compras del mes: {formatMoney(data.kpis.purchasesMonth, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Otros ingresos del mes</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(data.kpis.otherIncomeMonth, currency)}</p>
            <p className="text-xs text-muted-foreground">Fuera de ventas y abonos</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => { setType("egreso"); setDialog("movement"); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Registrar ingreso / egreso
        </Button>
      </div>

      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="cxc">
            Por cobrar ({data.accountsReceivable.length})
          </TabsTrigger>
          <TabsTrigger value="cxp">
            Por pagar ({data.accountsPayable.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No hay movimientos financieros registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {data.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("es-CO")}
                        </TableCell>
                        <TableCell className="max-w-64 truncate font-medium">{t.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {t.category.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">{t.method}</TableCell>
                        <TableCell
                          className={`text-right font-semibold ${t.type === "ingreso" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                        >
                          {t.type === "ingreso" ? "+" : "−"} {formatMoney(t.amount, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cxc">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Abonado</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.accountsReceivable.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No hay ventas a crédito pendientes. 🎉
                        </TableCell>
                      </TableRow>
                    )}
                    {data.accountsReceivable.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.folio}</TableCell>
                        <TableCell className="max-w-48 truncate">{r.customerName}</TableCell>
                        <TableCell>{formatMoney(r.total, currency)}</TableCell>
                        <TableCell className="text-emerald-600 dark:text-emerald-400">
                          {formatMoney(r.paid, currency)}
                        </TableCell>
                        <TableCell className="font-semibold">{formatMoney(r.balance, currency)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAbonoTarget({ id: r.id, folio: r.folio, balance: r.balance });
                              setAbonoAmount(String(r.balance));
                              setDialog("abono");
                            }}
                          >
                            <HandCoins className="mr-1 h-3.5 w-3.5" /> Abonar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cxp">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.accountsPayable.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No hay compras pendientes de pago. 🎉
                        </TableCell>
                      </TableRow>
                    )}
                    {data.accountsPayable.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.folio}</TableCell>
                        <TableCell className="max-w-48 truncate">{p.supplierName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString("es-CO")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoney(p.total, currency)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          Se paga desde el módulo de compras
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Registrar movimiento */}
      <Dialog open={dialog === "movement"} onOpenChange={(o) => !o && setDialog("none")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>
              Gastos operativos, ingresos por otros conceptos, anticipos…
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger aria-label="Tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger aria-label="Categoría">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operativo">Operativo</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-amount">Monto</Label>
              <Input
                id="f-amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger aria-label="Método">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-desc">Descripción</Label>
              <Input
                id="f-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: arriendo de la bodega"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>Cancelar</Button>
            <Button onClick={submitMovement} disabled={saving}>
              <Wallet className="mr-1.5 h-4 w-4" />
              {saving ? "Registrando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar abono */}
      <Dialog open={dialog === "abono"} onOpenChange={(o) => !o && setDialog("none")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abonar a {abonoTarget?.folio}</DialogTitle>
            <DialogDescription>
              Saldo pendiente: {abonoTarget ? formatMoney(abonoTarget.balance, currency) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="a-amount">Valor del abono</Label>
              <Input
                id="a-amount"
                type="number"
                min="1"
                value={abonoAmount}
                onChange={(e) => setAbonoAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Método</Label>
              <Select value={abonoMethod} onValueChange={setAbonoMethod}>
                <SelectTrigger aria-label="Método de abono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog("none")}>Cancelar</Button>
            <Button onClick={submitAbono} disabled={saving}>
              <HandCoins className="mr-1.5 h-4 w-4" />
              {saving ? "Registrando…" : "Registrar abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
