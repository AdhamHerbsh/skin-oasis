import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Filter } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { invoices, parties, partyLedger, settings } from "@/server/db/schema";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/server/permissions";
import { formatAmount } from "@/lib/number-format";
import { Locale } from "@/lib/i18n";
import { partyLedgerDescription, partyLedgerKindLabel } from "@/lib/party-ledger-labels";
import { ledgerAmount, partyLedgerBalanceDelta } from "@/server/services/ledger-math";

export default async function PartyStatement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  if (!(await getSessionUserId())) redirect("/login");
  await requirePermission("parties", "view");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [settingsRow] = await db.select({ locale: settings.locale }).from(settings).where(eq(settings.id, 1)).limit(1);
  const locale = (settingsRow?.locale === "en" ? "en" : "ar") as Locale;
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);
  const currency = locale === "en" ? "EGP" : "ج.م";
  const [party] = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
  if (!party) notFound();

  const [ledgerEntries, linkedInvoices] = await Promise.all([
    db.select().from(partyLedger).where(eq(partyLedger.partyId, id)).orderBy(asc(partyLedger.createdAt)),
    db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(eq(invoices.partyId, id)),
  ]);

  const hasOpening = ledgerEntries.some((entry) => entry.kind === "opening");
  const allEntries = (
    !hasOpening && Number(party.openingBalance) > 0
      ? [
          {
            id: "opening",
            partyId: id,
            invoiceId: null,
            kind: "opening",
            debit: party.type === "customer" ? party.openingBalance : "0",
            credit: party.type === "supplier" ? party.openingBalance : "0",
            notes: "رصيد افتتاحي",
            createdAt: party.createdAt,
          },
          ...ledgerEntries,
        ]
      : ledgerEntries
  ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const invoiceNumbers = new Map(linkedInvoices.map((item) => [item.id, item.number]));
  const transactionDescription = (entry: { kind: string; invoiceId: string | null; notes: string | null }) => {
    const invoiceNumber = entry.invoiceId ? invoiceNumbers.get(entry.invoiceId) : undefined;
    return partyLedgerDescription(entry.notes, entry.kind, invoiceNumber, locale);
  };
  const filtered = allEntries.filter(
    (entry) =>
      (!query.from || entry.createdAt >= new Date(`${query.from}T00:00:00`)) &&
      (!query.to || entry.createdAt <= new Date(`${query.to}T23:59:59`))
  );

  const rows = filtered.map((entry) => {
    const debit = ledgerAmount(entry.debit);
    const credit = ledgerAmount(entry.credit);
    const balance = allEntries
      .slice(0, allEntries.indexOf(entry) + 1)
      .reduce((total, item) => total + partyLedgerBalanceDelta(item, party.type), 0);
    return { ...entry, debit, credit, balance };
  });

  const finalBalance = rows.at(-1)?.balance ?? 0;

  return (
    <main className="main standalone">
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">{text("كشف حساب", "Account statement")} {party.type === "customer" ? text("عميل", "Customer") : text("مورد", "Supplier")}</p>
          <h1>{party.name}</h1>
        </div>
        <div className="top-actions">
          <PrintButton label={text("طباعة كشف الحساب", "Print account statement")} />
          <Link className="secondary" href="/parties">
            <ArrowRight size={15} />
            <span>{text("رجوع للأطراف", "Back to accounts")}</span>
          </Link>
        </div>
      </header>

      {/* Printable Statement Sheet */}
      <section className="panel statement-paper">
        <div className="paper-header">
          <div>
            <h2>{text("كشف حساب تفصيلي:", "Detailed account statement:")} {party.name}</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              {party.type === "customer" ? text("حساب عميل (مبيعات)", "Customer account (sales)") : text("حساب مورد (مشتريات وتوريد)", "Supplier account (purchases and supplies)")}
              {party.phone && ` · ${text("الهاتف:", "Phone:")} ${party.phone}`}
              {party.email && ` · ${text("البريد:", "Email:")} ${party.email}`}
            </p>
          </div>
          <div className="text-left">
            <span className="text-xs text-[var(--muted)] block mb-1">{text("الرصيد الصافي الحالي", "Current net balance")}</span>
            <span className={`text-xl font-extrabold ${finalBalance > 0 ? "text-indigo-700" : finalBalance < 0 ? "text-rose-600" : "text-emerald-700"}`}>
              {finalBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })} {currency}
            </span>
          </div>
        </div>

        {/* Date Filter Bar */}
        <form className="date-filter print-hide" method="get">
          <label>
            <span>{text("من تاريخ", "From date")}</span>
            <input type="date" name="from" defaultValue={query.from} />
          </label>
          <label>
            <span>{text("إلى تاريخ", "To date")}</span>
            <input type="date" name="to" defaultValue={query.to} />
          </label>
          <button className="secondary flex items-center gap-1.5 h-[36px]">
            <Filter size={13} />
            <span>{text("تصفية الفترة", "Filter period")}</span>
          </button>
        </form>

        {/* Ledger Entries Table */}
        <div className="table-wrap my-4">
          <table>
            <thead>
              <tr>
                <th>{text("التاريخ والوقت", "Date and time")}</th>
                <th>{text("نوع المعاملة", "Transaction type")}</th>
                <th>{text("البيان", "Description")}</th>
                <th>{text("رقم الفاتورة المرتبطة", "Related invoice")}</th>
                <th className="text-center">{text("مدين (لنا)", "Debit (receivable)")}</th>
                <th className="text-center">{text("دائن (له)", "Credit (payable)")}</th>
                <th className="text-center">{text("الرصيد التراكمي", "Running balance")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-xs text-[var(--muted)]">
                      {new Date(entry.createdAt).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}
                    </td>
                    <td className="font-semibold text-[var(--ink)]">
                      <span className="inline-flex rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 text-[10px] font-bold">
                        {partyLedgerKindLabel(entry.kind, party.type, Boolean(entry.invoiceId), locale)}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--muted)]">
                      {transactionDescription(entry)}
                    </td>
                    <td className="font-mono text-xs">
                      {entry.invoiceId && invoiceNumbers.has(entry.invoiceId) ? (
                        <Link href={`/invoices/${entry.invoiceId}`} className="text-link">
                          {invoiceNumbers.get(entry.invoiceId)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-center font-semibold text-rose-700">
                      {entry.debit !== 0 ? `${formatAmount(entry.debit, locale)} ${currency}` : "—"}
                    </td>
                    <td className="text-center font-semibold text-emerald-700">
                      {entry.credit !== 0 ? `${formatAmount(entry.credit, locale)} ${currency}` : "—"}
                    </td>
                    <td className="text-center font-bold text-[var(--ink)]">
                      {formatAmount(entry.balance, locale)} {currency}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="table-empty">
                    {text("لا توجد حركات مالية مسجلة في الفترة المحددة لهذا الحساب.", "No financial transactions were recorded for this account during the selected period.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[var(--muted)] mt-4 pt-3 border-t border-[var(--line)]">
          {text("* ملاحظة محاسبية: الرصيد الموجب يمثل مديونية مستحقة للتحصيل من العميل، أو مستحقات للمورد واجبة السداد.", "* Accounting note: a positive balance represents an amount receivable from a customer or payable to a supplier.")}
        </p>
      </section>
    </main>
  );
}
