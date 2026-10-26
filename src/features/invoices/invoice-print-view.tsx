"use client";

import { useState } from "react";
import Image from "next/image";
import {
  FileText,
  Printer,
  Receipt,
  Store,
  Truck,
  CheckSquare,
  Building,
} from "lucide-react";
import { useI18n } from "@/lib/i18n-client";
import { formatAmount } from "@/lib/number-format";
import { calculateInvoiceLineAmounts } from "@/lib/invoice-math";

type InvoiceData = {
  invoice: {
    id: string;
    number: string;
    type: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    paid: string;
    status: string;
    notes: string | null;
    createdAt: Date | string;
  };
  party: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    type: string;
  } | null;
  org: {
    organizationName: string;
    logoPath: string | null;
    phone: string | null;
    commercialRegistrationNumber: string | null;
    taxNumber: string | null;
    invoiceFooter: string | null;
  } | null;
  lines: {
    id: string;
    description: string;
    quantity: string;
    bonusQuantity: string;
    unitPrice: string;
    discountValue: string;
    discountType: "amount" | "percent";
    costPrice: string;
    lineTotal: string;
  }[];
  invoiceLogo: string | null;
};

export function InvoicePrintView({ data }: { data: InvoiceData }) {
  const { t, locale } = useI18n();
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);
  const currency = locale === "en" ? "EGP" : "ج.م";
  const [format, setFormat] = useState<"a4" | "a5" | "thermal" | "dispatch">("a4");
  const { invoice, party, org, lines, invoiceLogo } = data;
  const totalQuantity = lines.reduce(
    (sum, line) => sum + Number(line.quantity) + Number(line.bonusQuantity),
    0
  );
  const itemDiscountTotal = lines.reduce(
    (sum, line) =>
      sum + calculateInvoiceLineAmounts(
        Number(line.quantity),
        Number(line.unitPrice),
        Number(line.discountValue),
        line.discountType
      ).discount,
    0
  );
  const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paid));
  const dateFormatted = new Date(invoice.createdAt).toLocaleString(locale === "en" ? "en-US" : "ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = (mode: "a4" | "a5" | "thermal" | "dispatch") => {
    document.documentElement.classList.toggle("thermal-print", mode === "thermal");
    document.documentElement.classList.toggle("invoice-a5-print", mode === "a5");
    window.print();
    window.setTimeout(() => {
      document.documentElement.classList.remove("thermal-print", "invoice-a5-print");
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Format Selector Bar (Hidden on Print) */}
      <div className="print-hide flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-bold">
          <button
            type="button"
            onClick={() => setFormat("a4")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              format === "a4"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <FileText size={14} />
            <span>{t("invoices.formatA4", "فاتورة رسمية A4")}</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("a5")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              format === "a5"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <FileText size={14} />
            <span>{t("invoices.formatA5", "فاتورة A5")}</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("thermal")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              format === "thermal"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Receipt size={14} />
            <span>{t("invoices.formatThermal", "إيصال حراري (80mm)")}</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("dispatch")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              format === "dispatch"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Truck size={14} />
            <span>{t("invoices.formatDispatch", "إذن تسليم وصرف مخزني")}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePrint(format)}
            className="primary w-full sm:w-auto px-4 py-2 text-xs inline-flex items-center justify-center gap-1.5 font-bold shadow-xs cursor-pointer rounded-lg"
          >
            <Printer size={15} />
            <span>{t("invoices.printThis", "طباعة هذا النموذج")}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          FORMAT 1: A4 / A5 Commercial Tax Invoice
          ========================================================================= */}
      {(format === "a4" || format === "a5") && (
        <article className={`panel invoice-paper p-4 sm:p-6 md:p-8${format === "a5" ? " invoice-paper-a5" : ""}`}>
          <header className="paper-header pb-6 border-b border-[var(--line)]">
            <div className="flex items-center gap-4">
              {invoiceLogo ? (
                <Image
                  src={invoiceLogo}
                  alt={text("شعار المؤسسة", "Organization logo")}
                  width={64}
                  height={64}
                  unoptimized
                  className="rounded-xl object-contain border border-slate-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
                  <Store size={28} />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-[var(--ink)]">{org?.organizationName ?? "Apex Software"}</h2>
                {org?.commercialRegistrationNumber && (
                  <p className="text-xs font-semibold text-[var(--muted)] mt-1">
                    {t("settings.commercialRegistrationNumber", "Commercial registration number")}: {org.commercialRegistrationNumber}
                  </p>
                )}
                {org?.taxNumber && (
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {t("settings.taxNumber", "Tax number")}: {org.taxNumber}
                  </p>
                )}
                <p className="text-xs font-bold text-[var(--muted)] mt-1">
                  {invoice.type === "sale"
                    ? text("فاتورة مبيعات ", "Commercial sales tax invoice")
                    : invoice.type === "purchase"
                    ? text("فاتورة مشتريات وتوريد بضائع", "Purchase and goods supply invoice")
                    : invoice.type === "sale_return"
                    ? text("إشعار دائن — مرتجع مبيعات", "Credit note — sales return")
                    : text("إشعار مدين — مرتجع مشتريات", "Debit note — purchase return")}
                </p>
                {org?.phone && (
                  <p className="text-xs font-semibold text-[var(--muted)] mt-0.5">📞 {org.phone}</p>
                )}
              </div>
            </div>

            <div className="paper-meta text-left">
              <strong className="block text-base font-black text-[var(--ink)]">
                {text("رقم الفاتورة:", "Invoice number:")} <span className="font-mono text-indigo-700">{invoice.number}</span>
              </strong>
              <span className="block text-xs text-[var(--muted)] mt-1">{text("التاريخ:", "Date:")} {dateFormatted}</span>
              <span className="block text-xs text-[var(--muted)]">{text("الطرف:", "Party:")} <b className="text-[var(--ink)]">{party?.name ?? text("عميل صالة نقدي", "Walk-in customer")}</b></span>
              {party?.phone && <span className="block text-xs text-[var(--muted)]">{text("الهاتف:", "Phone:")} {party.phone}</span>}
              {party?.address && <span className="block text-xs text-[var(--muted)]">{text("العنوان:", "Address:")} {party.address}</span>}
              <div className="mt-2">
                <span className={`status ${invoice.status}`}>
                  {invoice.status === "paid" ? text("مدفوعة بالكامل", "Paid in full") : invoice.status === "partial" ? text("مدفوعة جزئياً", "Partially paid") : text("غير مدفوعة", "Unpaid")}
                </span>
              </div>
            </div>
          </header>

          {/* Table */}
          <div className="table-wrap my-6">
            <table>
              <thead>
                <tr>
                  <th className="text-center w-10">#</th>
                  <th>{text("اسم الصنف والبيان", "Item description")}</th>
                  <th className="text-center w-28">{text("الكمية", "Quantity")}</th>
                  <th className="text-center w-32">{text("سعر الوحدة", "Unit price")}</th>
                  <th className="text-center w-24">{text("البونص", "Bonus")}</th>
                  <th className="text-center w-28">{text("الخصم", "Discount")}</th>
                  <th className="text-center w-32">{text("السعر بعد الخصم", "Price after discount")}</th>
                  <th className="text-center w-36">{text("الإجمالي", "Total")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="text-center font-mono">{index + 1}</td>
                    <td className="font-bold text-[var(--ink)]">{line.description}</td>
                    <td className="text-center font-bold">{Number(line.quantity).toLocaleString("en-US")}</td>
                    <td className="text-center font-semibold">{Number(line.unitPrice).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</td>
                    <td className="text-center">{Number(line.bonusQuantity).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}</td>
                    <td className="text-center">{Number(line.discountValue).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}{line.discountType === "percent" ? "%" : ` ${currency}`}</td>
                    <td className="text-center font-semibold">{(Number(line.unitPrice) - calculateInvoiceLineAmounts(1, Number(line.unitPrice), Number(line.discountValue), line.discountType).discountPerUnit).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</td>
                    <td className="text-center font-bold text-[var(--ink)]">
                      {Number(line.lineTotal).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="invoice-item-summary">
                  <td colSpan={2}>{text("إجمالي عدد الأصناف", "Total items")}</td>
                  <td className="text-center">{lines.length.toLocaleString(locale === "en" ? "en-US" : "ar-EG")}</td>
                  <td colSpan={4} className="text-center">{text("إجمالي الكميات شامل البونص", "Total quantity incl. bonus")}</td>
                  <td className="text-center">{totalQuantity.toLocaleString(locale === "en" ? "en-US" : "ar-EG")}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Financial Totals */}
          <section className="invoice-totals">
            <p>
              <span>{text("المجموع قبل الخصم:", "Subtotal before discount:")}</span>
              <b>{Number(invoice.subtotal).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</b>
            </p>
            {itemDiscountTotal > 0 && (
              <p>
                <span>{text("خصومات الأصناف:", "Item discounts:")}</span>
                <b className="text-rose-600">− {itemDiscountTotal.toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</b>
              </p>
            )}
            {Number(invoice.discount) > 0 && (
              <p>
                <span>{text("الخصم الإضافي:", "Additional discount:")}</span>
                <b className="text-rose-600">− {Number(invoice.discount).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</b>
              </p>
            )}
            {Number(invoice.tax) > 0 && (
              <p>
                <span>{text("ضريبة القيمة المضافة:", "VAT:")}</span>
                <b>+ {Number(invoice.tax).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</b>
              </p>
            )}
            <p className="grand-total">
              <span>{text("الصافي المطلوب:", "Net total due:")}</span>
              <b>{Number(invoice.total).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</b>
            </p>
            <p>
              <span>{text("المسدد نقداً:", "Amount paid:")}</span>
              <b className="text-emerald-700">{Number(invoice.paid).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {currency}</b>
            </p>
            {remaining > 0 && (
              <p className="font-bold text-rose-600">
                <span>{text("المتبقي في الذمة:", "Balance due:")}</span>
                <b>{remaining.toLocaleString(locale === "en" ? "en-US" : "ar-EG", { maximumFractionDigits: 2 })} {currency}</b>
              </p>
            )}
          </section>

          {/* Signatures & Footer */}
          <div className="mt-12 pt-6 border-t border-[var(--line)] grid grid-cols-2 gap-8 text-center text-xs text-[var(--muted)]">
            <div>
              <p className="mb-8 font-semibold">{text("توقيع المستلم بما يفيد المعاينة والاستلام:", "Recipient signature confirming inspection and receipt:")}</p>
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
            </div>
            <div>
              <p className="mb-8 font-semibold">{text("توقيع المحاسب / إدارة المبيعات:", "Accountant / sales department signature:")}</p>
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
            </div>
          </div>

          {org?.invoiceFooter && (
            <footer className="paper-footer mt-6 text-center text-xs text-[var(--muted)]">
              <p className="whitespace-pre-line">{org.invoiceFooter}</p>
            </footer>
          )}
        </article>
      )}

      {/* =========================================================================
          FORMAT 2: 80mm Thermal Receipt POS
          ========================================================================= */}
      {format === "thermal" && (
        <article className="panel max-w-[340px] mx-auto p-4 font-mono text-xs bg-white text-black border border-slate-300 shadow-md">
          <div className="text-center pb-3 border-b border-dashed border-black">
            {invoiceLogo && (
              <div className="flex justify-center mb-2">
                <Image
                  src={invoiceLogo}
                  alt={text("شعار", "Logo")}
                  width={48}
                  height={48}
                  unoptimized
                  className="object-contain"
                />
              </div>
            )}
            <h2 className="text-base font-black">{org?.organizationName ?? "Apex Software"}</h2>
            {org?.commercialRegistrationNumber && (
              <p className="text-[10px]">{t("settings.commercialRegistrationNumber", "Commercial registration number")}: {org.commercialRegistrationNumber}</p>
            )}
            {org?.taxNumber && (
              <p className="text-[10px]">{t("settings.taxNumber", "Tax number")}: {org.taxNumber}</p>
            )}
            <p className="text-[11px] mt-0.5">
              {invoice.type === "sale" ? text("إيصال مبيعات نقدية", "Sales receipt") : text("إيصال توريد", "Purchase receipt")}
            </p>
            {org?.phone && <p className="text-[10px] font-semibold mt-0.5">📞 {org.phone}</p>}
            <p className="text-[10px] text-slate-600 mt-1">{text("رقم الفاتورة:", "Invoice number:")} #{invoice.number}</p>
            <p className="text-[10px] text-slate-600">{dateFormatted}</p>
            <p className="text-[11px] font-bold mt-1">{text("الطرف:", "Party:")} {party?.name ?? text("عميل صالة", "Walk-in customer")}</p>
          </div>

          <div className="py-2 border-b border-dashed border-black">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-400">
                  <th className="text-right py-1">{text("الصنف", "Item")}</th>
                  <th className="text-center py-1">{text("الكمية", "Qty")}</th>
                  <th className="text-left py-1">{text("الإجمالي", "Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-300">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1 font-bold">
                      {l.description}
                      <span className="block text-[9px] font-normal">
                        {formatAmount(l.unitPrice)} − {Number(l.discountValue).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}{l.discountType === "percent" ? "%" : ` ${currency}`} = {formatAmount(Number(l.unitPrice) - calculateInvoiceLineAmounts(1, Number(l.unitPrice), Number(l.discountValue), l.discountType).discountPerUnit)} {currency}
                      </span>
                    </td>
                    <td className="py-1 text-center font-bold">{l.quantity}{Number(l.bonusQuantity) > 0 ? ` + ${l.bonusQuantity} ${text("بونص", "bonus")}` : ""}</td>
                    <td className="py-1 text-left">{formatAmount(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="py-2 space-y-1 text-xs border-b border-dashed border-black">
            <div className="flex justify-between">
              <span>{text("المجموع:", "Subtotal:")}</span>
              <span>{formatAmount(invoice.subtotal)} {currency}</span>
            </div>
            {itemDiscountTotal > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>{text("خصومات الأصناف:", "Item discounts:")}</span>
                <span>−{formatAmount(itemDiscountTotal)} {currency}</span>
              </div>
            )}
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>{text("الخصم الإضافي:", "Additional discount:")}</span>
                <span>−{formatAmount(invoice.discount)} {currency}</span>
              </div>
            )}
            {Number(invoice.tax) > 0 && (
              <div className="flex justify-between">
                <span>{text("الضريبة:", "Tax:")}</span>
                <span>+{formatAmount(invoice.tax)} {currency}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-black">
              <span>{text("الصافي المطلوب:", "Net total due:")}</span>
              <span>{formatAmount(invoice.total)} {currency}</span>
            </div>
            <div className="flex justify-between">
              <span>{text("المدفوع:", "Paid:")}</span>
              <span>{formatAmount(invoice.paid)} {currency}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between font-bold text-rose-700">
                <span>{text("المتبقي:", "Remaining:")}</span>
                <span>{formatAmount(remaining)} {currency}</span>
              </div>
            )}
          </div>

          <div className="pt-3 text-center text-[10px] space-y-1">
            <p className="font-bold">{text("شكراً لتعاملكم معنا!", "Thank you for your business!")}</p>
            {org?.invoiceFooter && <p className="whitespace-pre-line">{org.invoiceFooter}</p>}
          </div>
        </article>
      )}

      {/* =========================================================================
          FORMAT 3: Warehouse Dispatch Slip (إذن صرف وتسليم مستودع)
          ========================================================================= */}
      {format === "dispatch" && (
        <article className="panel invoice-paper p-6 md:p-8">
          <header className="paper-header pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              {invoiceLogo ? (
                <Image
                  src={invoiceLogo}
                  alt={text("شعار المؤسسة", "Organization logo")}
                  width={52}
                  height={52}
                  unoptimized
                  className="rounded-lg object-contain border border-slate-300"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Truck size={24} />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-[var(--ink)]">{text("إذن صرف وتسليم بضاعة من المستودع", "Warehouse dispatch and delivery slip")}</h2>
                {org?.commercialRegistrationNumber && (
                  <p className="text-xs text-[var(--muted)]">{t("settings.commercialRegistrationNumber", "Commercial registration number")}: {org.commercialRegistrationNumber}</p>
                )}
                {org?.taxNumber && (
                  <p className="text-xs text-[var(--muted)]">{t("settings.taxNumber", "Tax number")}: {org.taxNumber}</p>
                )}
                <p className="text-xs text-[var(--muted)] font-bold">{text("مستند تحضير ومطابقة المخزون والتسليم للعميل", "Document for picking, stock verification, and customer delivery")}</p>
                {org?.phone && (
                  <p className="text-xs font-semibold text-indigo-700 mt-0.5">📞 {org.phone}</p>
                )}
              </div>
            </div>

            <div className="paper-meta text-left">
              <strong className="block text-lg font-black text-[var(--ink)] font-mono">
                {text("كود الإذن:", "Dispatch number:")} {invoice.number}
              </strong>
              <span className="block text-xs text-[var(--muted)]">{text("تاريخ ووقت التحضير:", "Prepared at:")} {dateFormatted}</span>
              <span className="block text-xs font-bold text-indigo-700">
                {text("اسم المستلم:", "Recipient:")} {party?.name ?? text("عميل صالة", "Walk-in customer")}
              </span>
              {party?.phone && <span className="block text-xs text-[var(--muted)]">{text("هاتف التواصل:", "Contact phone:")} {party.phone}</span>}
              {party?.address && <span className="block text-xs text-[var(--muted)]">{text("عنوان التسليم:", "Delivery address:")} {party.address}</span>}
            </div>
          </header>

          {/* Warehouse Checklist Table */}
          <div className="table-wrap my-6">
            <table>
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="w-16 text-center">{text("فحص", "Check")}</th>
                  <th className="w-12 text-center">#</th>
                  <th>{text("اسم الصنف ومواصفات البند", "Item description")}</th>
                  <th className="text-center w-36">{text("الكمية المصروفة", "Quantity dispatched")}</th>
                  <th className="text-center w-32">{text("الحالة المخزنية", "Stock status")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.id} className="border-b border-slate-200">
                    <td className="text-center">
                      <div className="w-5 h-5 border-2 border-slate-400 rounded mx-auto" />
                    </td>
                    <td className="text-center text-xs text-[var(--muted)] font-mono">{idx + 1}</td>
                    <td className="font-bold text-[var(--ink)] text-sm">{line.description}</td>
                    <td className="text-center font-mono font-black text-base text-indigo-700">
                      {Number(line.quantity).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}
                      {Number(line.bonusQuantity) > 0 && (
                        <span className="block text-xs text-emerald-700">
                          + {Number(line.bonusQuantity).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} {text("بونص", "bonus")}
                        </span>
                      )}
                    </td>
                    <td className="text-center text-xs font-semibold text-emerald-700">
                      {text("تم الصرف من المستودع", "Dispatched from warehouse")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg mb-6 text-xs">
              <span className="font-bold block mb-1">{text("ملاحظات التحضير والشحن:", "Picking and shipping notes:")}</span>
              <span>{invoice.notes}</span>
            </div>
          )}

          {/* Warehouse Signatures */}
          <div className="mt-8 pt-6 border-t-2 border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
              <p className="font-bold text-[var(--ink)] mb-10">{text("أمين المستودع (المحضّر)", "Warehouse keeper (prepared by)")}</p>
              <p className="border-t border-dashed border-slate-400 pt-2 text-[11px] text-[var(--muted)]">{text("التوقيع والاسم", "Signature and name")}</p>
            </div>
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
              <p className="font-bold text-[var(--ink)] mb-10">{text("مندوب الشحن / السائق", "Delivery driver")}</p>
              <p className="border-t border-dashed border-slate-400 pt-2 text-[11px] text-[var(--muted)]">{text("التوقيع ورقم المركبة", "Signature and vehicle number")}</p>
            </div>
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
              <p className="font-bold text-[var(--ink)] mb-10">{text("توقيع العميل / المستلم", "Customer / recipient signature")}</p>
              <p className="border-t border-dashed border-slate-400 pt-2 text-[11px] text-[var(--muted)]">{text("تم الاستلام بحالة سليمة", "Received in good condition")}</p>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
