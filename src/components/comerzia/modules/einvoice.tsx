"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileCheck2, FileWarning, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStoreSettings } from "../dashboard";
import { formatMoney } from "@/lib/format";

interface Doc {
  id: string;
  folio: string;
  customerName: string;
  subtotal: number;
  discount: number;
  couponDiscount: number;
  tax: number;
  total: number;
  cufe: string | null;
  einvoiceStatus: string;
  createdAt: string;
}

export default function EinvoiceModule({
  version,
  notifyChange,
}: {
  version: number;
  notifyChange: () => void;
}) {
  const { settings } = useStoreSettings();
  const currency = settings?.currency ?? "COP";
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [emitting, setEmitting] = useState<string | null>(null);

  const load = () => {
    fetch("/api/einvoice")
      .then((r) => r.json())
      .then((d) => {
        setDocs(d.documents ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) => d.folio.toLowerCase().includes(q) || d.customerName.toLowerCase().includes(q)
    );
  }, [docs, query]);

  const pending = docs.filter((d) => !d.cufe).length;
  const issued = docs.filter((d) => d.cufe).length;

  const emit = async (d: Doc) => {
    setEmitting(d.id);
    try {
      const res = await fetch("/api/einvoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: d.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo emitir el documento.");
        return;
      }
      toast.success(`Factura ${d.folio} emitida. CUFE: ${data.document.cufe.slice(0, 24)}…`);
      notifyChange();
      load();
    } finally {
      setEmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emitidas</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{issued}</p>
            <p className="text-xs text-muted-foreground">con CUFE generado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            <FileWarning className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pending}</p>
            <p className="text-xs text-muted-foreground">ventas sin documento electrónico</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emisor</CardTitle>
            <QrCode className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-bold">{settings?.storeName ?? "COMERZIA"}</p>
            <p className="text-xs text-muted-foreground">
              NIT {settings?.taxId || "900.123.456-7"} · validación DIAN simulada
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por folio o cliente…"
              className="max-w-md"
              aria-label="Buscar documentos"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>CUFE</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No hay ventas completadas para facturar.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.folio}</TableCell>
                    <TableCell className="max-w-40 truncate">{d.customerName}</TableCell>
                    <TableCell className="font-semibold">{formatMoney(d.total, currency)}</TableCell>
                    <TableCell className="max-w-28 truncate font-mono text-xs text-muted-foreground">
                      {d.cufe ? d.cufe.slice(0, 10) + "…" : "—"}
                    </TableCell>
                    <TableCell>
                      {d.cufe ? (
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Emitida
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.cufe ? (
                        <a href={`/api/einvoice/xml?id=${d.id}`} download>
                          <Button size="sm" variant="outline">
                            <Download className="mr-1 h-3.5 w-3.5" /> XML
                          </Button>
                        </a>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => emit(d)}
                          disabled={emitting === d.id}
                        >
                          <FileCheck2 className="mr-1 h-3.5 w-3.5" />
                          {emitting === d.id ? "Emitiendo…" : "Emitir"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ℹ️ En esta demostración la emisión genera un CUFE (SHA-384) y el XML con estructura UBL 2.1 de
        referencia. La validación real ante la DIAN debe hacerse mediante un proveedor tecnológico
        autorizado y se integra con este mismo módulo.
      </p>
    </div>
  );
}
