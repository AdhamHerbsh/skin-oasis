"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, RotateCcw, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n-client";

const ERROR_TRANSLATIONS: Record<string, string> = {
  INSUFFICIENT_CASHBOX_BALANCE: "رصيد الصندوق/الخزينة المحددة غير كافٍ لإتمام هذه المعاملة النقدية.",
  CASH_TRANSACTION_NOT_FOUND: "الحركة النقدية غير موجودة أو تم حذفها بالفعل.",
  CASH_TRANSACTION_LINKED: "لا يمكن حذف هذه الحركة من دفتر الخزنة لأنها مرتبطة بفاتورة أو حساب عميل/مورد. احذفها أو عدّلها من المستند المرتبط.",
  CASH_TRANSACTION_DELETE_NEGATIVE_BALANCE: "لا يمكن حذف الحركة لأن ذلك سيجعل رصيد إحدى الخزنات سالبًا.",
  CASH_TRANSFER_INCOMPLETE: "تعذر حذف التحويل لأن طرفيه غير مكتملين أو لا يتطابق مبلغهما. راجع سجل الحركات.",
  INSUFFICIENT_STOCK: "الكمية المطلوبة في الفاتورة غير متوفرة في رصيد المخزن حالياً.",
  CASHBOX_OPENING_BALANCE_LOCKED: "لا يمكن تعديل الرصيد الافتتاحي للخزينة بعد تسجيل حركات نقدية وفواتير عليها لحماية القيود المحاسبية.",
  CASHBOX_NOT_FOUND: "الصندوق أو الخزينة المحددة غير موجودة أو تم إلغاء تنشيطها.",
  ACCOUNT_NOT_FOUND: "حساب الطرف (العميل أو المورد) غير موجود في النظام.",
  PARTY_NOT_FOUND: "بيانات العميل أو المورد غير مسجلة.",
  ANONYMOUS_CREDIT_NOT_ALLOWED: "لا يمكن إصدار فاتورة آجلة بدون تحديد العميل المسجل لحفظ المديونية في دفتر الأستاذ.",
  TRANSFER_SAME_CASHBOX: "لا يمكن إجراء تحويل مالي بين نفس الصندوق.",
  USERNAME_EXISTS: "اسم المستخدم هذا مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر.",
  PASSWORD_REQUIRED: "كلمة المرور مطلوبة عند إضافة مستخدم جديد (10 خانات على الأقل).",
  CANNOT_DISABLE_SELF: "لا يمكنك تعطيل أو حذف حسابك الشخصي الذي تستخدمه حالياً.",
  NEGATIVE_STOCK: "لا يمكن إجراء تسوية تجعل رصيد المخزون بالسالب.",
  INVALID_LINE: "بيانات أحد بنود الفاتورة غير مكتملة أو تحتوي على كميات غير صالحة.",
  PRICE_BELOW_COST: "تنبيه: سعر البيع المحدد للصنف أقل من سعر تكلفته المعتمد في المخزن.",
  FORBIDDEN: "عفواً، حسابك لا يملك الصلاحيات الكافية لتنفيذ هذا الإجراء.",
  UNAUTHENTICATED: "انتهت جلسة تسجيل الدخول، يرجى إعادة تسجيل الدخول مرة أخرى.",
  INVALID_PARTY: "بيانات العميل أو المورد غير مكتملة، يرجى مراجعة الاسم والبيانات المدخلة.",
  INVALID_PRODUCT: "بيانات الصنف غير صالحة، يرجى التأكد من اسم الصنف والأسعار.",
  INVALID_INVOICE: "بيانات الفاتورة غير صحيحة، يرجى مراجعة الأصناف والمبالغ المدخلة.",
  INVOICE_NOT_FOUND: "الفاتورة غير موجودة أو تم حذفها بالفعل.",
  INVOICE_HAS_LINKED_RETURNS: "لا يمكن حذف الفاتورة لوجود مرتجعات مرتبطة بها.",
  CANNOT_REVERSE_INVOICE_STOCK: "لا يمكن حذف الفاتورة لأن عكس حركتها سيؤدي إلى رصيد مخزون سالب.",
  CANNOT_REVERSE_INVOICE_CASH_TRANSACTION: "لا يمكن عكس إحدى الحركات النقدية المرتبطة بهذه الفاتورة.",
  CANNOT_REVERSE_INVOICE_CASH_BALANCE: "لا يمكن حذف الفاتورة لأن عكس التحصيل سيؤدي إلى رصيد خزينة سالب.",
};
const ERROR_TRANSLATIONS_EN: Record<string, string> = {
  INSUFFICIENT_CASHBOX_BALANCE: "The selected cashbox does not have enough balance for this transaction.",
  CASH_TRANSACTION_NOT_FOUND: "The cash transaction could not be found or has already been deleted.",
  CASH_TRANSACTION_LINKED: "This transaction is linked to an invoice or customer/supplier account. Delete or edit it from its source record.",
  CASH_TRANSACTION_DELETE_NEGATIVE_BALANCE: "This transaction cannot be deleted because doing so would make a cashbox balance negative.",
  CASH_TRANSFER_INCOMPLETE: "The transfer cannot be deleted because its two sides are missing or have different amounts. Review the cash ledger.",
  INSUFFICIENT_STOCK: "The requested invoice quantity is not available in stock.",
  CASHBOX_OPENING_BALANCE_LOCKED: "The opening balance cannot be changed after cash transactions or invoices have been recorded.",
  CASHBOX_NOT_FOUND: "The selected cashbox does not exist or is inactive.",
  ACCOUNT_NOT_FOUND: "The selected customer or supplier account does not exist.",
  PARTY_NOT_FOUND: "The customer or supplier could not be found.",
  ANONYMOUS_CREDIT_NOT_ALLOWED: "Credit invoices require a registered customer account.",
  TRANSFER_SAME_CASHBOX: "A transfer cannot use the same cashbox as both source and destination.",
  USERNAME_EXISTS: "That username is already registered. Choose another username.",
  PASSWORD_REQUIRED: "A password of at least 10 characters is required for a new user.",
  CANNOT_DISABLE_SELF: "You cannot disable or delete your own account.",
  NEGATIVE_STOCK: "This stock adjustment would result in a negative balance.",
  INVALID_LINE: "An invoice line is incomplete or contains an invalid quantity.",
  PRICE_BELOW_COST: "The sale price is below the product's recorded cost.",
  FORBIDDEN: "Your account does not have permission to perform this action.",
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  INVALID_PARTY: "Customer or supplier details are incomplete or invalid.",
  INVALID_PRODUCT: "Product details are invalid. Check the product name and prices.",
  INVALID_INVOICE: "Invoice details are invalid. Check the items and amounts.",
  INVOICE_NOT_FOUND: "The invoice could not be found or has already been deleted.",
  INVOICE_HAS_LINKED_RETURNS: "This invoice cannot be deleted because it has linked return invoices.",
  CANNOT_REVERSE_INVOICE_STOCK: "This invoice cannot be deleted because reversing it would make stock negative.",
  CANNOT_REVERSE_INVOICE_CASH_TRANSACTION: "A cash transaction linked to this invoice cannot be reversed.",
  CANNOT_REVERSE_INVOICE_CASH_BALANCE: "This invoice cannot be deleted because reversing its receipts would make a cashbox balance negative.",
};

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale, isRtl } = useI18n();
  useEffect(() => {
    console.error("Application runtime error:", error);
  }, [error]);

  const rawMessage = error?.message || "";
  let userFriendlyMessage = "";

  for (const [code, arabicText] of Object.entries(ERROR_TRANSLATIONS)) {
    if (rawMessage.includes(code)) {
      userFriendlyMessage = locale === "en" ? ERROR_TRANSLATIONS_EN[code] ?? arabicText : arabicText;
      break;
    }
  }

  if (!userFriendlyMessage) {
    if (rawMessage.includes("INSUFFICIENT_STOCK")) {
      userFriendlyMessage = locale === "en" ? "The requested quantity exceeds the available stock." : "الكمية المطلوبة لبعض الأصناف أكبر من رصيد المخزن المتاح.";
    } else if (rawMessage.includes("PRICE_BELOW_COST")) {
      userFriendlyMessage = locale === "en" ? "The sale price is below the product's recorded cost." : "سعر البيع المدخل أقل من سعر التكلفة المعتمد في النظام.";
    } else {
      userFriendlyMessage = locale === "en" ? "An error occurred while processing your request. Check your input and try again." : "حدث تنبيه أثناء معالجة البيانات، يرجى مراجعة المدخلات والمحاولة مرة أخرى.";
    }
  }

  return (
    <main className="min-h-[75vh] flex items-center justify-center p-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="w-full max-w-lg bg-[var(--panel)] border border-[var(--line-strong)] rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto shadow-xs">
          <AlertTriangle size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-[var(--ink)]">{locale === "en" ? "Something went wrong" : "تنبيه أثناء معالجة العملية"}</h2>
          <p className="text-sm font-bold text-slate-700 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/60 leading-relaxed">
            {userFriendlyMessage}
          </p>
        </div>

        {error.digest && (
          <p className="text-[11px] text-[var(--muted)] font-mono">
            {locale === "en" ? "Error reference:" : "رمز التتبع الفني:"} {error.digest}
          </p>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="primary w-full sm:w-auto px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 rounded-xl cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>{locale === "en" ? "Try again" : "محاولة مرة أخرى"}</span>
          </button>

          <Link
            href="/"
            className="secondary w-full sm:w-auto px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 rounded-xl"
          >
            <Home size={15} />
            <span>{locale === "en" ? "Back to dashboard" : "العودة للوحة التحكم"}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
