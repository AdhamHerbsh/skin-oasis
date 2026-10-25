import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Banknote, Landmark, Plus, Receipt, Wallet, Pencil, Trash2 } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { cashTransactions, cashboxes, permissions, settings, users } from "@/server/db/schema";
import { addCashTransaction, createCashbox, deactivateCashbox, deleteCashTransaction, transferCash, updateCashbox } from "@/features/finance/actions";
import { requirePermission } from "@/server/permissions";
import { CloseDisclosureButton } from "@/components/close-disclosure-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function FinancePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("finance", "view");

  const [user] = await db
    .select({ roleId: users.roleId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const grants = user
    ? await db
        .select({ action: permissions.action })
        .from(permissions)
        .where(eq(permissions.roleId, user.roleId))
    : [];

  const canCreate = grants.some((grant) => grant.action === "create");
  const canEdit = grants.some((grant) => grant.action === "edit");
  const canDelete = grants.some((grant) => grant.action === "delete");
  const [settingsRow] = await db.select({ locale: settings.locale }).from(settings).where(eq(settings.id, 1)).limit(1);
  const locale = settingsRow?.locale === "en" ? "en" : "ar";
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);
  const currency = locale === "en" ? "EGP" : "ج.م";
  const transactionLabel = (kind: string) =>
    ({
      income: text("إيراد", "Income"),
      expense: text("مصروف", "Expense"),
      transfer_in: text("تحويل وارد", "Transfer in"),
      transfer_out: text("تحويل صادر", "Transfer out"),
      invoice_payment: text("تحصيل فاتورة", "Invoice payment"),
      party_payment: text("سند عميل/مورد", "Party payment"),
    })[kind] ?? kind;

  const [boxes, txs, aggregates, allBoxes] = await Promise.all([
    db.select().from(cashboxes).where(eq(cashboxes.active, true)),
    db.select().from(cashTransactions).orderBy(desc(cashTransactions.createdAt)).limit(100),
    db
      .select({
        cashboxId: cashTransactions.cashboxId,
        balance: sql<string>`coalesce(sum(case when ${cashTransactions.kind} in ('income','transfer_in','invoice_payment','party_payment') then ${cashTransactions.amount} else -${cashTransactions.amount} end),0)`,
      })
      .from(cashTransactions)
      .groupBy(cashTransactions.cashboxId),
    db.select({ id: cashboxes.id, name: cashboxes.name }).from(cashboxes),
  ]);

  const totals = new Map(aggregates.map((x) => [x.cashboxId, Number(x.balance)]));
  const isTransactionLinked = (tx: (typeof txs)[number]) =>
    Boolean(
      tx.invoiceId ||
        tx.partyId ||
        tx.kind === "invoice_payment" ||
        tx.kind === "party_payment" ||
        ((tx.kind === "transfer_in" || tx.kind === "transfer_out") && !tx.transferId),
    );
  const grandTotalCash = boxes.reduce(
    (sum, box) => sum + (Number(box.openingBalance) + (totals.get(box.id) ?? 0)),
    0
  );

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">{text("الخزينة والمقبوضات", "Cash and receipts")}</p>
          <h1>{text("المالية والصناديق النقدية", "Finance and cashboxes")}</h1>
        </div>
        <div className="top-actions">
          <Link className="secondary" href="/">
            <ArrowRight size={15} />
            <span>{text("الرئيسية", "Home")}</span>
          </Link>
        </div>
      </header>

      {/* Cashbox Balance Cards (Themed & Enlarged) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {boxes.map((box) => {
          const balance = Number(box.openingBalance) + (totals.get(box.id) ?? 0);
          const isBank = box.kind === "bank";
          const isWallet = box.kind === "wallet";
          const themeClasses = isBank
            ? "bg-blue-50/70 border-blue-200 text-blue-950"
            : isWallet
            ? "bg-purple-50/70 border-purple-200 text-purple-950"
            : "bg-teal-50/70 border-teal-200 text-teal-950";
          const iconClasses = isBank
            ? "bg-blue-100 text-blue-700"
            : isWallet
            ? "bg-purple-100 text-purple-700"
            : "bg-teal-100 text-teal-700";
          const balanceColor = isBank
            ? "text-blue-900"
            : isWallet
            ? "text-purple-900"
            : "text-teal-900";

          return (
            <article className={`p-5 rounded-2xl border ${themeClasses} flex flex-col justify-between`} key={box.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{box.name}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${iconClasses}`}>
                  {isBank ? <Landmark size={18} /> : isWallet ? <Wallet size={18} /> : <Banknote size={18} />}
                </div>
              </div>
              <div>
                <strong className={`text-2xl lg:text-3xl font-black font-mono tracking-tight block ${balanceColor}`}>
                  {balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} <small className="text-xs font-bold opacity-80">{currency}</small>
                </strong>
                <p className="text-xs font-medium opacity-75 mt-1">
                  {box.kind === "cash" ? text("صندوق كاشير نقدي", "Cash register") : isBank ? text("حساب بنكي معتمد", "Bank account") : text("محفظة إلكترونية", "E-wallet")} · {text("رصيد فعلي", "Current balance")}
                </p>
              </div>
              {(canEdit || canDelete) && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-current/10 pt-3">
                  {canEdit && (
                    <details className="group w-full">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-current/20 bg-white/70 px-3 py-2 text-xs font-bold"><Pencil size={13} /> {text("تعديل بيانات الخزنة", "Edit cashbox")}</summary>
                      <form action={updateCashbox} className="form-grid mt-3 rounded-xl border border-current/15 bg-white/80 p-3">
                        <input type="hidden" name="id" value={box.id} />
                        <label>{text("اسم الخزنة", "Cashbox name")}<input name="name" defaultValue={box.name} required minLength={2} maxLength={100} /></label>
                        <label>{text("نوع الخزنة", "Cashbox type")}<select name="kind" defaultValue={box.kind}><option value="cash">{text("نقدي", "Cash")}</option><option value="bank">{text("حساب بنكي", "Bank account")}</option><option value="wallet">{text("محفظة إلكترونية", "E-wallet")}</option></select></label>
                        <label className="wide-field">{text("الرصيد الافتتاحي", "Opening balance")} ({currency})<input name="openingBalance" type="number" min="0" step="0.01" defaultValue={box.openingBalance} required /></label>
                        <button className="primary"><Pencil size={13} /> {text("حفظ التعديلات", "Save changes")}</button>
                      </form>
                    </details>
                  )}
                  {canDelete && (
                    <form action={deactivateCashbox} className="inline-flex">
                      <input type="hidden" name="id" value={box.id} />
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        <Trash2 size={13} /> {text("حذف الخزنة", "Delete cashbox")}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* Action Buttons for Finance Operations (Themed & Interactive Transformation) */}
      {canCreate && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Button 1: Add Cashbox / Bank */}
          <details className="group editor" name="finance-action-modal">
            <summary className="h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center gap-2 border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 group-open:bg-emerald-600 group-open:text-white group-open:border-emerald-700 group-open:ring-2 group-open:ring-emerald-400 group-open:ring-offset-2 active:scale-95 transition-all cursor-pointer select-none">
              <span className="w-5 h-5 rounded-lg bg-emerald-200/80 group-open:bg-emerald-500 text-emerald-800 group-open:text-white flex items-center justify-center transition-colors">
                <Plus size={13} className="transition-transform duration-200 group-open:rotate-45" />
              </span>
              <span>{text("إضافة صندوق نقدية / بنك", "Add cashbox / bank account")}</span>
            </summary>
            <form action={createCashbox} className="form-grid">
              <CloseDisclosureButton title={text("إضافة صندوق أو حساب مالي جديد", "Add cashbox or financial account")} />
              <label>
                {text("اسم الصندوق أو الحساب", "Cashbox or account name")}
                <input name="name" required minLength={2} placeholder={text("مثال: الخزينة الرئيسية، كاشير الصالة", "Example: Main cashbox, showroom register")} />
              </label>
              <label>
                {text("نوع الصندوق", "Cashbox type")}
                <select name="kind">
                  <option value="cash">{text("نقدي (كاشير / خزينة)", "Cash (register / cashbox)")}</option>
                  <option value="bank">{text("حساب بنكي", "Bank account")}</option>
                  <option value="wallet">{text("محفظة إلكترونية", "E-wallet")}</option>
                </select>
              </label>
              <label className="wide-field">
                {text("الرصيد الافتتاحي المبدئي", "Opening balance")} ({currency})
                <input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" required />
              </label>
              <button className="primary w-full py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-0 cursor-pointer active:scale-98 transition-all">
                {text("حفظ الصندوق وتفعيله", "Save and activate cashbox")}
              </button>
            </form>
          </details>

          {/* Button 2: Record Income / Expense */}
          <details className="group editor" name="finance-action-modal">
            <summary className="h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center gap-2 border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 group-open:bg-indigo-600 group-open:text-white group-open:border-indigo-700 group-open:ring-2 group-open:ring-indigo-400 group-open:ring-offset-2 active:scale-95 transition-all cursor-pointer select-none">
              <span className="w-5 h-5 rounded-lg bg-indigo-200/80 group-open:bg-indigo-500 text-indigo-800 group-open:text-white flex items-center justify-center transition-colors">
                <Receipt size={13} className="transition-transform duration-200 group-open:scale-110" />
              </span>
              <span>{text("تسجيل دخل أو مصروف", "Record income or expense")}</span>
            </summary>
            <form action={addCashTransaction} className="form-grid">
              <CloseDisclosureButton title={text("تسجيل سند دخل أو مصروف نقدي", "Record income or expense")} />
              <label>
                {text("الصندوق المتأثر", "Cashbox")}
                <select name="cashboxId" required>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text("نوع الحركة", "Transaction type")}
                <select name="kind">
                  <option value="income">{text("إيراد / دخل نقدي (+)", "Income (+)")}</option>
                  <option value="expense">{text("مصروف تشغيلي / نثريات (−)", "Operating expense (−)")}</option>
                </select>
              </label>
              <label>
                {text("التصنيف أو بند الصرف", "Category or expense item")}
                <input name="category" required minLength={2} placeholder={text("مثال: كهرباء، إيجار، بوفيه، إيراد صيانة", "Example: Electricity, rent, supplies, maintenance income")} />
              </label>
              <label>
                {text("المبلغ", "Amount")} ({currency})
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
              <label className="wide-field">
                {text("ملاحظات وتفاصيل إضافية", "Additional notes")}
                <input name="notes" placeholder={text("ملاحظات توضيحية لدفتر الحسابات", "Notes for the account ledger")} />
              </label>
              <button className="primary w-full py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white border-0 cursor-pointer active:scale-98 transition-all">
                {text("تسجيل الحركة وترحيلها", "Record transaction")}
              </button>
            </form>
          </details>

          {/* Button 3: Transfer between Cashboxes */}
          <details className="group editor" name="finance-action-modal">
            <summary className="h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center gap-2 border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 group-open:bg-purple-600 group-open:text-white group-open:border-purple-700 group-open:ring-2 group-open:ring-purple-400 group-open:ring-offset-2 active:scale-95 transition-all cursor-pointer select-none">
              <span className="w-5 h-5 rounded-lg bg-purple-200/80 group-open:bg-purple-500 text-purple-800 group-open:text-white flex items-center justify-center transition-colors">
                <ArrowLeftRight size={13} className="transition-transform duration-300 group-open:rotate-180" />
              </span>
              <span>{text("تحويل مالي بين الصناديق", "Transfer between cashboxes")}</span>
            </summary>
            <form action={transferCash} className="form-grid">
              <CloseDisclosureButton title={text("سند تحويل نقدية بين الصناديق", "Cashbox transfer")} />
              <label>
                {text("من الصندوق (المُحوِّل)", "From cashbox")}
                <select name="from" required>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text("إلى الصندوق (المُستلِم)", "To cashbox")}
                <select name="to" required>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide-field">
                {text("المبلغ المراد تحويله", "Transfer amount")} ({currency})
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
              <label className="wide-field">
                {text("ملاحظات التحويل", "Transfer notes")}
                <input name="notes" placeholder={text("مثال: إيداع نقدي في البنك، تغذية عهدة الكاشير", "Example: Bank deposit, cash register float")} />
              </label>
              <button className="primary w-full py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white border-0 cursor-pointer active:scale-98 transition-all">
                {text("تنفيذ التحويل المالي", "Submit transfer")}
              </button>
            </form>
          </details>
        </div>
      )}

      {/* Cash Transactions Table */}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h3>{text("دفتر الحركات النقدية", "Cash transaction ledger")}</h3>
            <p>{text("سجل المقبوضات والمصروفات والتحويلات المسجلة", "Record of income, expenses, and transfers")}</p>
          </div>
          <span className="date-pill">{text("إجمالي السيولة:", "Total liquidity:")} {grandTotalCash.toLocaleString("en-US")} {currency}</span>
        </div>

        <div className="desktop-table-only table-wrap">
          <table>
            <thead>
              <tr>
                <th>{text("التاريخ والوقت", "Date and time")}</th>
                <th>{text("الصندوق", "Cashbox")}</th>
                <th>{text("نوع الحركة", "Transaction type")}</th>
                <th>{text("التصنيف", "Category")}</th>
                <th>{text("المبلغ", "Amount")}</th>
                <th>{text("ملاحظات", "Notes")}</th>
                {canDelete && <th>{text("إجراء", "Action")}</th>}
              </tr>
            </thead>
            <tbody>
              {txs.length ? (
                txs.map((tx) => {
                  const isPositive = ["income", "transfer_in", "invoice_payment", "party_payment"].includes(tx.kind);
                  return (
                    <tr key={tx.id}>
                      <td className="text-xs text-[var(--muted)] font-medium">
                        {new Date(tx.createdAt).toLocaleString("en-US")}
                      </td>
                      <td className="font-bold text-[var(--ink)]">
                        {allBoxes.find((box) => box.id === tx.cashboxId)?.name ?? text("خزنة محذوفة", "Deleted cashbox")}
                      </td>
                      <td>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {transactionLabel(tx.kind)}
                        </span>
                      </td>
                      <td className="text-xs font-semibold text-[var(--ink)]">{tx.category ?? "—"}</td>
                      <td className={`font-bold ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                        {isPositive ? "+" : "−"} {Number(tx.amount).toLocaleString("en-US")} {currency}
                      </td>
                      <td className="text-xs text-[var(--muted)]">{tx.notes ?? "—"}</td>
                      {canDelete && (
                        <td>
                          {isTransactionLinked(tx) ? (
                            <span className="text-xs text-[var(--muted)]">
                              {text("مرتبطة بمستند", "Linked to a record")}
                            </span>
                          ) : (
                            <form action={deleteCashTransaction} className="inline-flex">
                              <input type="hidden" name="id" value={tx.id} />
                              <ConfirmSubmitButton
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                                confirmMessage={
                                  tx.transferId
                                    ? text(
                                        "سيتم حذف طرفي هذا التحويل وتحديث أرصدة الخزنتين. هل تريد المتابعة؟",
                                        "Both sides of this transfer will be deleted and both cashbox balances updated. Continue?",
                                      )
                                    : text(
                                        "هل أنت متأكد من حذف هذه الحركة وتحديث رصيد الخزنة؟",
                                        "Are you sure you want to delete this transaction and update the cashbox balance?",
                                      )
                                }
                              >
                                <Trash2 size={13} /> {text("حذف الحركة", "Delete transaction")}
                              </ConfirmSubmitButton>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="table-empty">
                    {text("لا توجد حركات مسجلة. أضف صندوقًا أو سجل عملية نقدية للبدء.", "No transactions recorded. Add a cashbox or record a cash transaction to get started.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cash Transactions Cards */}
        <div className="mobile-cards-only space-y-2.5">
          {txs.length ? (
            txs.map((tx) => {
              const isPositive = ["income", "transfer_in", "invoice_payment", "party_payment"].includes(tx.kind);
              const boxName = allBoxes.find((box) => box.id === tx.cashboxId)?.name ?? text("خزنة محذوفة", "Deleted cashbox");
              return (
                <div key={`mob-tx-${tx.id}`} className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b className="text-xs font-bold text-[var(--ink)] block">{boxName}</b>
                      <span className="text-[11px] text-[var(--muted)] font-mono">
                        {new Date(tx.createdAt).toLocaleString("en-US")}
                      </span>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        isPositive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {transactionLabel(tx.kind)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                    <span className="text-xs text-[var(--muted)] font-semibold truncate max-w-[60%]">
                      {tx.category ? `${tx.category} · ` : ""}{tx.notes ?? text("بدون ملاحظات", "No notes")}
                    </span>
                    <b className={`text-sm font-black font-mono shrink-0 ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                      {isPositive ? "+" : "−"} {Number(tx.amount).toLocaleString("en-US")} {currency}
                    </b>
                  </div>
                  {canDelete && (
                    isTransactionLinked(tx) ? (
                      <p className="text-xs text-[var(--muted)]">
                        {text("مرتبطة بمستند ولا يمكن حذفها من الخزنة.", "Linked to a record; delete it from its source.")}
                      </p>
                    ) : (
                      <form action={deleteCashTransaction} className="flex justify-end">
                        <input type="hidden" name="id" value={tx.id} />
                        <ConfirmSubmitButton
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                          confirmMessage={
                            tx.transferId
                              ? text(
                                  "سيتم حذف طرفي هذا التحويل وتحديث أرصدة الخزنتين. هل تريد المتابعة؟",
                                  "Both sides of this transfer will be deleted and both cashbox balances updated. Continue?",
                                )
                              : text(
                                  "هل أنت متأكد من حذف هذه الحركة وتحديث رصيد الخزنة؟",
                                  "Are you sure you want to delete this transaction and update the cashbox balance?",
                                )
                          }
                        >
                          <Trash2 size={13} /> {text("حذف الحركة", "Delete transaction")}
                        </ConfirmSubmitButton>
                      </form>
                    )
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-sm text-[var(--muted)] bg-[var(--panel)] border border-[var(--line)] rounded-xl">
              {text("لا توجد حركات مسجلة.", "No transactions recorded.")}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
