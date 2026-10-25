import Link from "next/link";
import { asc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Filter } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { invoices, parties, partyLedger, settings } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { formatAmount } from "@/lib/number-format";
import { Locale, translate } from "@/lib/i18n";
import { partyLedgerDescription, partyLedgerKindLabel } from "@/lib/party-ledger-labels";
import { ledgerAmount, partyLedgerBalanceDelta } from "@/server/services/ledger-math";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ partyId?: string; from?: string; to?: string }>;
}) {
  if (!(await getSessionUserId())) redirect("/login");
  await requirePermission("parties", "view");

  const query = await searchParams;
  const [settingsRow] = await db.select({ locale: settings.locale }).from(settings).where(eq(settings.id, 1)).limit(1);
  const locale = (settingsRow?.locale === "en" ? "en" : "ar") as Locale;
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);
  const currency = locale === "en" ? "EGP" : "ج.م";
  const accounts = await db
    .select({
      id: parties.id,
      name: parties.name,
      type: parties.type,
      openingBalance: parties.openingBalance,
    })
    .from(parties)
    .where(isNull(parties.deletedAt))
    .orderBy(parties.type, parties.name)
    .limit(1000);

  const party = query.partyId ? accounts.find((account) => account.id === query.partyId) : undefined;
  const entries = party
    ? await db
        .select()
        .from(partyLedger)
        .where(eq(partyLedger.partyId, party.id))
        .orderBy(asc(partyLedger.createdAt), asc(partyLedger.id))
    : [];
  const linkedInvoices = party
    ? await db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(eq(invoices.partyId, party.id))
    : [];
  const invoiceNumbers = new Map(linkedInvoices.map((invoice) => [invoice.id, invoice.number]));
  const transactionDescription = (entry: { kind: string; invoiceId: string | null; notes: string | null }) => {
    const invoiceNumber = entry.invoiceId ? invoiceNumbers.get(entry.invoiceId) : undefined;
    return partyLedgerDescription(entry.notes, entry.kind, invoiceNumber, locale);
  };

  const hasOpening = entries.some((entry) => entry.kind === "opening");
  const ledger =
    party && !hasOpening
      ? [
          {
            id: "opening",
            partyId: party.id,
            invoiceId: null,
            kind: "opening",
            debit: party.type === "customer" ? party.openingBalance : "0",
            credit: party.type === "supplier" ? party.openingBalance : "0",
            notes: "رصيد افتتاحي",
            createdAt: new Date(0),
          },
          ...entries,
        ]
      : entries;

  const computed = ledger.reduce<{
    balance: number;
    rows: ((typeof ledger)[number] & { debitAmount: number; creditAmount: number; balance: number })[];
  }>(
    (state, entry) => {
      const debitAmount = ledgerAmount(entry.debit);
      const creditAmount = ledgerAmount(entry.credit);
      const balance = state.balance + partyLedgerBalanceDelta(entry, party?.type ?? "customer");
      return { balance, rows: [...state.rows, { ...entry, debitAmount, creditAmount, balance }] };
    },
    { balance: 0, rows: [] }
  );

  const rows = computed.rows.filter(
    (entry) =>
      entry.id === "opening" ||
      ((!query.from || entry.createdAt >= new Date(`${query.from}T00:00:00`)) &&
        (!query.to || entry.createdAt <= new Date(`${query.to}T23:59:59.999`)))
  );

  const balance = rows.at(-1)?.balance ?? 0;

  return (
    <main className="main standalone">
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">{text("المحاسبة والتقارير المالية", "Accounting and financial reports")}</p>
          <h1>{text("كشوف حسابات العملاء والموردين", "Customer and supplier statements")}</h1>
        </div>
        <div className="top-actions">
          {party && <PrintButton label={text("طباعة الكشف المحدد", "Print selected statement")} />}
          <Link className="secondary" href="/parties">
            <ArrowRight size={15} />
            <span>{translate("nav.parties", locale)}</span>
          </Link>
        </div>
      </header>

      {/* Account Selection and Filter Bar */}
      <section className="panel print-hide">
        <div className="panel-title mb-3">
          <div>
            <h3>{text("تحديد الحساب والفترة", "Select account and date range")}</h3>
            <p>{text("اختر العميل أو المورد لعرض دفتر الحركات التفصيلي مع الرصيد الجاري", "Choose a customer or supplier to view the detailed transaction ledger and running balance")}</p>
          </div>
        </div>

        <form className="date-filter mb-0" method="get">
          <label className="min-w-[260px]">
            <span>{text("اختيار الحساب *", "Select account *")}</span>
            <select name="partyId" defaultValue={party?.id ?? ""} required>
              <option value="" disabled>
                {text("-- اختر عميلًا أو موردًا من الدليل --", "-- Select a customer or supplier --")}
              </option>
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.type === "customer" ? text("عميل", "Customer") : text("مورد", "Supplier")} · {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{text("من تاريخ", "From date")}</span>
            <input type="date" name="from" defaultValue={query.from} />
          </label>
          <label>
            <span>{text("إلى تاريخ", "To date")}</span>
            <input type="date" name="to" defaultValue={query.to} />
          </label>
          <button className="primary flex items-center gap-1.5 h-[36px]">
            <Filter size={14} />
            <span>{text("استعراض الكشف", "View statement")}</span>
          </button>
        </form>
      </section>

      {/* Statement Document */}
      <section className="panel statement-paper">
        <div className="paper-header">
          <div>
            <h2>{party ? `${text("كشف حساب:", "Account statement:")} ${party.name}` : text("كشف الحساب المالي", "Financial statement")}</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              {party
                ? party.type === "customer"
                  ? text("سجل حساب عميل — مبيعات ومسحوبات", "Customer account — sales and withdrawals")
                  : text("سجل حساب مورد — توريدات ومستحقات", "Supplier account — purchases and payables")
                : text("يرجى اختيار حساب من القائمة أعلاه", "Select an account above")}
            </p>
          </div>
          {party && (
            <div className="text-left">
              <span className="text-xs text-[var(--muted)] block mb-1">{text("الرصيد الختامي", "Closing balance")}</span>
              <strong className={`text-xl font-extrabold ${balance > 0 ? "text-indigo-700" : balance < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                {balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} {currency}
              </strong>
            </div>
          )}
        </div>

        {party ? (
          <>
            <div className="desktop-table-only table-wrap my-4">
              <table>
                <thead>
                  <tr>
                    <th>{text("التاريخ والوقت", "Date and time")}</th>
                    <th>{text("نوع المعاملة", "Transaction type")}</th>
                    <th>{text("البيان", "Description")}</th>
                    <th>{text("رقم الفاتورة", "Invoice #")}</th>
                    <th className="text-center">{text("مدين (لنا)", "Debit (receivable)")}</th>
                    <th className="text-center">{text("دائن (له)", "Credit (payable)")}</th>
                    <th className="text-center">{text("الرصيد الجاري", "Running balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-xs text-[var(--muted)]">
                        {entry.createdAt.getTime() === 0
                          ? text("رصيد افتتاحي سابق", "Opening balance")
                          : new Date(entry.createdAt).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}
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
                        ) : "—"}
                      </td>
                      <td className="text-center font-semibold">
                        {entry.debitAmount !== 0 ? `${formatAmount(entry.debitAmount, locale)} ${currency}` : "—"}
                      </td>
                      <td className="text-center font-semibold">
                        {entry.creditAmount !== 0 ? `${formatAmount(entry.creditAmount, locale)} ${currency}` : "—"}
                      </td>
                      <td className="text-center font-bold text-[var(--ink)]">
                        {formatAmount(entry.balance, locale)} {currency}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="table-empty">
                        {text("لا توجد حركات مالية مسجلة لهذا الحساب خلال الفترة المحددة.", "No financial transactions were recorded for this account during the selected period.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards-only space-y-2.5 my-4">
              {rows.length ? (
                rows.map((entry) => (
                  <div key={`mob-stmt-${entry.id}`} className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-xs font-bold text-[var(--ink)]">
                        {partyLedgerKindLabel(entry.kind, party.type, Boolean(entry.invoiceId), locale)}
                      </b>
                      <span className="text-[11px] text-[var(--muted)] font-mono shrink-0">
                        {entry.createdAt.getTime() === 0
                          ? text("رصيد افتتاحي", "Opening balance")
                          : new Date(entry.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-EG")}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--muted)]">{transactionDescription(entry)}</p>
                    {entry.invoiceId && invoiceNumbers.has(entry.invoiceId) && (
                      <Link href={`/invoices/${entry.invoiceId}`} className="text-link text-[11px]">
                        {text("فاتورة رقم:", "Invoice #")} {invoiceNumbers.get(entry.invoiceId)}
                      </Link>
                    )}

                    <div className="grid grid-cols-3 gap-2 py-1.5 px-2 bg-[var(--bg)] rounded-lg text-center border border-[var(--line)]">
                      <div>
                        <span className="text-[10px] text-[var(--muted)] block">{text("مدين (لنا)", "Debit (receivable)")}</span>
                        <b className="text-xs text-rose-700 font-semibold">
                          {entry.debitAmount !== 0 ? `${formatAmount(entry.debitAmount, locale)} ${currency}` : "—"}
                        </b>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--muted)] block">{text("دائن (له)", "Credit (payable)")}</span>
                        <b className="text-xs text-emerald-700 font-semibold">
                          {entry.creditAmount !== 0 ? `${formatAmount(entry.creditAmount, locale)} ${currency}` : "—"}
                        </b>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--muted)] block">{text("الرصيد", "Balance")}</span>
                        <b className="text-xs text-[var(--ink)] font-semibold">
                          {formatAmount(entry.balance, locale)} {currency}
                        </b>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-[var(--muted)] bg-[var(--panel)] border border-[var(--line)] rounded-xl">
                  {text("لا توجد حركات مسجلة لهذا الحساب.", "No transactions were recorded for this account.")}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state py-12">
            <div className="empty-icon">
              <BookOpen size={20} />
            </div>
            <b>{text("اختر عميلًا أو موردًا من القائمة أعلاه", "Select a customer or supplier above")}</b>
            <p className="text-xs text-[var(--muted)] mt-1">
              {text("سيظهر لك كشف الحساب التراكمي مفصلًا بالحركات، مع إمكانية طباعة تقرير رسمي فوري.", "The running account statement will show detailed transactions and can be printed as an official report.")}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
