import Link from "next/link";
import Image from "next/image";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Edit3, Store } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  cashTransactions,
  cashboxes,
  invoiceLines,
  invoices,
  parties,
  partyLedger,
  permissions,
  products,
  settings,
  units,
  users,
} from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import { InvoicePrintView } from "@/features/invoices/invoice-print-view";
import { localLogoUrl } from "@/server/services/branding";
import { Locale, translate } from "@/lib/i18n";

export default async function InvoiceDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("invoices", "view");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const editModeRequested = query.edit === "1";
  const [row] = await db
    .select({ invoice: invoices, party: parties, org: settings })
    .from(invoices)
    .leftJoin(parties, eq(invoices.partyId, parties.id))
    .leftJoin(settings, eq(settings.id, 1))
    .where(eq(invoices.id, id))
    .limit(1);

  if (!row) notFound();
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
  const invoiceProductNames = [
    ...new Set(lines.map((line) => line.description.replace(/\s+\[.*\]\s*$/, "").trim()).filter(Boolean)),
  ];

  const [editGrant, activeProducts, originalProducts, descriptionProducts, activeCashboxes, invoiceCash, activeParties, allUnits, ledgerBalances, invoiceLedgerRows] = await Promise.all([
    db
      .select({ id: permissions.id })
      .from(users)
      .innerJoin(permissions, eq(users.roleId, permissions.roleId))
      .where(
        and(
          eq(users.id, userId),
          eq(users.active, true),
          eq(permissions.module, "invoices"),
          eq(permissions.action, "edit")
        )
      )
      .limit(1),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        stock: products.stock,
        salePrice: products.salePrice,
        costPrice: products.costPrice,
        unitId: products.unitId,
      })
      .from(products)
      .where(and(eq(products.active, true), isNull(products.deletedAt))),
    lines.some((line) => line.productId)
      ? db
          .select({
            id: products.id,
            name: products.name,
            sku: products.sku,
            barcode: products.barcode,
            stock: products.stock,
            salePrice: products.salePrice,
            costPrice: products.costPrice,
            unitId: products.unitId,
          })
          .from(products)
          .where(
            inArray(
              products.id,
              lines.flatMap((line) => (line.productId ? [line.productId] : []))
            )
          )
      : Promise.resolve([]),
    invoiceProductNames.length > 0
      ? db
          .select({
            id: products.id,
            name: products.name,
            sku: products.sku,
            barcode: products.barcode,
            stock: products.stock,
            salePrice: products.salePrice,
            costPrice: products.costPrice,
            unitId: products.unitId,
          })
          .from(products)
          .where(inArray(products.name, invoiceProductNames))
      : Promise.resolve([]),
    db.select({ id: cashboxes.id, name: cashboxes.name }).from(cashboxes).where(eq(cashboxes.active, true)),
    db
      .select()
      .from(cashTransactions)
      .where(eq(cashTransactions.invoiceId, id))
      .orderBy(desc(cashTransactions.createdAt)),
    db
      .select({ id: parties.id, name: parties.name, type: parties.type })
      .from(parties)
      .where(isNull(parties.deletedAt)),
    db
      .select({ id: units.id, name: units.name, factor: units.factor })
      .from(units)
      .orderBy(units.factor),
    db.select({ partyId: partyLedger.partyId, balance: sql<string>`coalesce(sum(${partyLedger.debit} - ${partyLedger.credit}), 0)` }).from(partyLedger).groupBy(partyLedger.partyId),
    db.select({ debit: partyLedger.debit, credit: partyLedger.credit }).from(partyLedger).where(eq(partyLedger.invoiceId, id)),
  ]);

  const productOptions = [
    ...new Map([...activeProducts, ...originalProducts, ...descriptionProducts].map((product) => [product.id, product])).values(),
  ];
  const defaultCashbox =
    invoiceCash.find((entry) => activeCashboxes.some((box) => box.id === entry.cashboxId))?.cashboxId ?? "";
  const invoiceLogo = localLogoUrl(row.org?.logoPath);
  const invoice = row.invoice;
  const locale = (row.org?.locale === "en" ? "en" : "ar") as Locale;
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);
  const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paid));
  const canEditInvoice = editGrant.length > 0 && (invoice.type === "sale" || invoice.type === "purchase");
  const showEditPage = editModeRequested && canEditInvoice;
  const partyBalances = Object.fromEntries(ledgerBalances.map(({ partyId, balance }) => [partyId, Number(balance)]));
  if (invoice.partyId) {
    const invoiceBalanceEffect = invoiceLedgerRows.reduce((sum, entry) => sum + Number(entry.debit) - Number(entry.credit), 0);
    partyBalances[invoice.partyId] = (partyBalances[invoice.partyId] ?? 0) - invoiceBalanceEffect;
  }

  const initialInvoice = {
    id: invoice.id,
    type: invoice.type,
    partyId: invoice.partyId,
    cashboxId: defaultCashbox,
    paid: invoice.paid,
    discount: invoice.discount,
    tax: invoice.tax,
    lines: lines.map((line) => {
      const unitMatch = line.description.match(/\s+\[(.*?)(?:\s+×\s+(\d+(?:\.\d+)?))?\]\s*$/);
      const unitName = unitMatch?.[1];
      const descriptionName = line.description.replace(/\s+\[.*\]\s*$/, "").trim();
      const product =
        productOptions.find((item) => item.id === line.productId) ??
        productOptions.find((item) => item.name.trim() === descriptionName);
      const matchedUnit = unitName ? allUnits.find((unit) => unit.name === unitName) : undefined;
      const productUnit = allUnits.find((unit) => unit.id === product?.unitId);
      const unitFactor = unitMatch?.[2] ?? matchedUnit?.factor ?? productUnit?.factor;

      return {
        productId: product?.id ?? line.productId ?? "",
        name: product?.name ?? descriptionName,
        quantity: line.quantity,
        bonusQuantity: line.bonusQuantity,
        unitPrice: line.unitPrice,
        discountValue: line.discountValue,
        discountType: line.discountType === "percent" ? ("percent" as const) : ("amount" as const),
        unitId: matchedUnit?.id ?? productUnit?.id,
        unitName,
        unitFactor,
        basePrice: String(Number(line.unitPrice) / (Number(unitFactor) || 1)),
        minPrice: String(Number(product?.costPrice ?? 0) * (Number(unitFactor) || 1)),
      };
    }),
  };

  if (showEditPage) {
    return (
      <main className="main standalone">
        <header className="topbar print-hide">
          <div>
            <p className="eyebrow">{text("تعديل تفاصيل الفاتورة", "Edit invoice details")}</p>
            <h1>{text("فاتورة", "Invoice")} {invoice.number}</h1>
          </div>
          <Link className="secondary" href={`/invoices/${invoice.id}`}>
            <ArrowRight size={15} />
            <span>{text("العودة إلى الفاتورة", "Back to invoice")}</span>
          </Link>
        </header>
        <section className="panel">
          <InvoiceForm
            products={productOptions}
            parties={activeParties}
            cashboxes={activeCashboxes}
            units={allUnits}
            partyBalances={partyBalances}
            initial={initialInvoice}
            fullPageEdit
          />
        </section>
      </main>
    );
  }

  return (
    <main className="main standalone">
      {/* Top Header & Actions (Hidden on Print) */}
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">{text("معاينة الفاتورة والطباعة", "Invoice preview and printing")}</p>
          <h1>{text("فاتورة", "Invoice")} {invoice.number}</h1>
        </div>
        <div className="top-actions">
          {canEditInvoice && (
            <Link className="primary" href={`/invoices/${invoice.id}?edit=1`}>
              <Edit3 size={15} />
              <span>{text("تعديل الفاتورة", "Edit invoice")}</span>
            </Link>
          )}
          <Link className="secondary" href="/invoices">
            <ArrowRight size={15} />
            <span>{translate("invoices.backToList", locale, "سجل الفواتير")}</span>
          </Link>
        </div>
      </header>

      {/* Invoice Multi-Format View & Print Component */}
      <InvoicePrintView
        data={{
          invoice: row.invoice,
          party: row.party,
          org: row.org,
          lines: lines.map((line) => ({
            ...line,
            discountType: line.discountType === "percent" ? ("percent" as const) : ("amount" as const),
          })),
          invoiceLogo,
        }}
      />
    </main>
  );
}
