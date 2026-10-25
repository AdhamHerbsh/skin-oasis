import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { cashTransactions, cashboxes, invoices, parties, settings } from "@/server/db/schema";

function Shell({ title, children, locale }: { title: string; children: React.ReactNode; locale: "ar" | "en" }) {
  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">{locale === "en" ? "Skin Oasis" : "لمسة جمال"}</p>
          <h1>{title}</h1>
        </div>
        <Link className="secondary" href="/">
          <ArrowRight size={15} />
          <span>{locale === "en" ? "Back to dashboard" : "العودة للوحة التحكم"}</span>
        </Link>
      </header>
      {children}
    </main>
  );
}

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  if (!(await getSessionUserId())) redirect("/login");
  const { section } = await params;
  const [settingsRow] = await db.select({ locale: settings.locale }).from(settings).where(eq(settings.id, 1)).limit(1);
  const locale = settingsRow?.locale === "en" ? "en" : "ar";
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);

  if (section === "invoices") {
    const rows = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(100);
    return (
      <Shell title={text("الفواتير", "Invoices")} locale={locale}>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>{text("سجل الفواتير", "Invoice register")}</h3>
              <p>{text("أحدث 100 عملية مسجلة", "Latest 100 recorded transactions")}</p>
            </div>
            <span className="date-pill">{rows.length} {text("فاتورة", "invoices")}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{text("الرقم", "Number")}</th>
                  <th>{text("النوع", "Type")}</th>
                  <th>{text("التاريخ", "Date")}</th>
                  <th>{text("الإجمالي", "Total")}</th>
                  <th>{text("المدفوع", "Paid")}</th>
                  <th>{text("الحالة", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((x) => (
                    <tr key={x.id}>
                      <td className="font-bold">{x.number}</td>
                      <td>{x.type === "sale" ? text("بيع", "Sale") : x.type === "purchase" ? text("شراء", "Purchase") : x.type === "sale_return" ? text("مرتجع بيع", "Sales return") : text("مرتجع شراء", "Purchase return")}</td>
                      <td>{new Date(x.createdAt).toLocaleDateString("en-US")}</td>
                      <td className="font-bold">{Number(x.total).toLocaleString("en-US")} {text("ج.م", "EGP")}</td>
                      <td className="font-semibold text-emerald-600">{Number(x.paid).toLocaleString("en-US")} {text("ج.م", "EGP")}</td>
                      <td>
                        <span className={`status ${x.status}`}>{x.status === "paid" ? text("مدفوع", "Paid") : x.status === "partial" ? text("جزئي", "Partial") : text("غير مدفوع", "Unpaid")}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      {text("لا توجد فواتير مسجلة", "No invoices recorded")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Shell>
    );
  }

  if (section === "parties") {
    const rows = await db.select().from(parties).orderBy(desc(parties.createdAt)).limit(100);
    return (
      <Shell title={text("العملاء والموردون", "Customers and suppliers")} locale={locale}>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>{text("دليل الحسابات", "Account directory")}</h3>
              <p>{text("العملاء والموردون المسجلون", "Registered customers and suppliers")}</p>
            </div>
            <span className="date-pill">{rows.length} {text("حساب", "accounts")}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{text("الاسم", "Name")}</th>
                  <th>{text("الصفة", "Type")}</th>
                  <th>{text("الهاتف", "Phone")}</th>
                  <th>{text("البريد", "Email")}</th>
                  <th>{text("رصيد أول المدة", "Opening balance")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((x) => (
                    <tr key={x.id}>
                      <td className="font-bold">{x.name}</td>
                      <td>{x.type === "customer" ? text("عميل", "Customer") : text("مورد", "Supplier")}</td>
                      <td className="font-mono text-xs">{x.phone || "—"}</td>
                      <td className="text-xs">{x.email || "—"}</td>
                      <td className="font-bold">{Number(x.openingBalance).toLocaleString("en-US")} {text("ج.م", "EGP")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      {text("لا توجد حسابات مسجلة", "No accounts recorded")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Shell>
    );
  }

  if (section === "finance") {
    const boxes = await db.select().from(cashboxes).where(eq(cashboxes.active, true));
    const txs = await db.select().from(cashTransactions).orderBy(desc(cashTransactions.createdAt)).limit(100);
    const total =
      boxes.reduce((sum, b) => sum + Number(b.openingBalance), 0) +
      txs.reduce(
        (sum, t) =>
          sum +
          (["income", "transfer_in", "invoice_payment", "party_payment"].includes(t.kind)
            ? Number(t.amount)
            : -Number(t.amount)),
        0
      );

    return (
      <Shell title={text("المالية", "Finance")} locale={locale}>
        <section className="kpis">
          <article className="kpi">
            <div className="kpi-head">
              <span>{text("إجمالي السيولة النقدية", "Total cash liquidity")}</span>
            </div>
            <strong>
              {total.toLocaleString("en-US")} <small>{text("ج.م", "EGP")}</small>
            </strong>
          </article>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>{text("الصناديق والحركات الأخيرة", "Cashboxes and recent transactions")}</h3>
              <p>{text("الرصيد الافتتاحي مضاف إليه حركات الدفتر", "Opening balance plus recorded ledger transactions")}</p>
            </div>
          </div>
          <div className="table-wrap mb-4">
            <table>
              <thead>
                <tr>
                  <th>{text("الصندوق", "Cashbox")}</th>
                  <th>{text("النوع", "Type")}</th>
                  <th>{text("الرصيد الافتتاحي", "Opening balance")}</th>
                </tr>
              </thead>
              <tbody>
                {boxes.length ? (
                  boxes.map((x) => (
                    <tr key={x.id}>
                      <td className="font-bold">{x.name}</td>
                      <td>{x.kind === "cash" ? text("نقدي", "Cash") : x.kind === "bank" ? text("حساب بنكي", "Bank account") : text("محفظة إلكترونية", "E-wallet")}</td>
                      <td className="font-bold">{Number(x.openingBalance).toLocaleString("en-US")} {text("ج.م", "EGP")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      {text("لا توجد صناديق نقدية مسجلة", "No cashboxes recorded")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{text("التاريخ", "Date")}</th>
                  <th>{text("النوع", "Type")}</th>
                  <th>{text("المبلغ", "Amount")}</th>
                  <th>{text("ملاحظات", "Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {txs.length ? (
                  txs.map((x) => (
                    <tr key={x.id}>
                      <td className="text-xs">{new Date(x.createdAt).toLocaleString("en-US")}</td>
                      <td>{x.kind === "income" ? text("إيراد", "Income") : x.kind === "expense" ? text("مصروف", "Expense") : x.kind === "transfer_in" ? text("تحويل وارد", "Transfer in") : x.kind === "transfer_out" ? text("تحويل صادر", "Transfer out") : text("حركة فاتورة", "Invoice payment")}</td>
                      <td className="font-bold">{Number(x.amount).toLocaleString("en-US")} {text("ج.م", "EGP")}</td>
                      <td className="text-xs">{x.notes || x.category || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      {text("لا توجد حركات نقدية مسجلة", "No cash transactions recorded")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Shell>
    );
  }

  if (section === "settings") {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    return (
      <Shell title={text("الإعدادات", "Settings")} locale={locale}>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>{text("إعدادات المؤسسة", "Organization settings")}</h3>
            </div>
          </div>
          {row ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <th>{text("اسم المؤسسة", "Organization name")}</th>
                    <td className="font-bold">{row.organizationName}</td>
                  </tr>
                  <tr>
                    <th>{text("اللغة", "Language")}</th>
                    <td>{row.locale === "ar" ? "العربية" : "English"}</td>
                  </tr>
                  <tr>
                    <th>{text("العملة", "Currency")}</th>
                    <td className="font-mono">{row.currency}</td>
                  </tr>
                  <tr>
                    <th>{text("نسبة الضريبة", "Tax rate")}</th>
                    <td>{row.taxRate}%</td>
                  </tr>
                  <tr>
                    <th>{text("نص تذييل الفاتورة", "Invoice footer")}</th>
                    <td>{row.invoiceFooter || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">{text("لا توجد إعدادات محفوظة.", "No settings saved.")}</p>
          )}
        </section>
      </Shell>
    );
  }

  redirect("/");
}
