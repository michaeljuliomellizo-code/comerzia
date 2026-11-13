import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/einvoice/xml?id=… — descarga la representación XML del documento (simulada UBL 2.1)
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el parámetro id." }, { status: 400 });
  }

  const sale = await db.sale.findFirst({ where: { id, organizationId: orgId }, include: { items: true } });
  if (!sale || !sale.cufe) {
    return NextResponse.json(
      { error: "Esta venta no tiene factura electrónica emitida." },
      { status: 404 }
    );
  }

  const settings = ctx.settings;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = sale.items
    .map(
      (it, i) => `    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="UN">${it.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${it.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${esc(it.name)}</cbc:Description>
        <cac:SellersItemIdentification><cbc:ID>${esc(it.sku ?? "")}</cbc:ID></cac:SellersItemIdentification>
      </cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="COP">${it.unitPrice.toFixed(2)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ID>${esc(sale.folio)}</cbc:ID>
  <cbc:UUID schemeName="CUFE-SHA384">${sale.cufe}</cbc:UUID>
  <cbc:IssueDate>${sale.createdAt.toISOString().slice(0, 10)}</cbc:IssueDate>
  <cbc:IssueTime>${sale.createdAt.toISOString().slice(11, 19)}-05:00</cbc:IssueTime>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(settings?.storeName ?? "COMERZIA")}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme><cbc:CompanyID>${esc(settings?.taxId ?? "900.123.456-7")}</cbc:CompanyID></cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party><cac:PartyName><cbc:Name>${esc(sale.customerName)}</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${sale.tax.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${sale.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${(sale.subtotal - sale.discount - sale.couponDiscount).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:PayableAmount currencyID="COP">${sale.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="factura-${sale.folio}.xml"`,
    },
  });
}
