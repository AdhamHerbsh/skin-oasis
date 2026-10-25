import type { Locale } from "@/lib/i18n";

export function partyLedgerKindLabel(
  kind: string,
  partyType: "customer" | "supplier",
  invoiceLinked: boolean,
  locale: Locale
): string {
  if (kind === "payment") {
    const labels = invoiceLinked
      ? {
          customer: { ar: "دفعة على فاتورة بيع", en: "Payment on sales invoice" },
          supplier: { ar: "دفعة على فاتورة شراء", en: "Payment on purchase invoice" },
        }
      : {
          customer: { ar: "سند قبض من العميل", en: "Customer receipt" },
          supplier: { ar: "سند صرف للمورد", en: "Supplier payment" },
        };
    return labels[partyType][locale];
  }

  const labels: Record<string, { ar: string; en: string }> = {
    sale: { ar: "فاتورة بيع", en: "Sales invoice" },
    purchase: { ar: "فاتورة شراء", en: "Purchase invoice" },
    sale_return: { ar: "مرتجع مبيعات", en: "Sales return" },
    purchase_return: { ar: "مرتجع مشتريات", en: "Purchase return" },
    opening: { ar: "رصيد افتتاحي", en: "Opening balance" },
    adjustment: { ar: "تسوية حساب", en: "Account adjustment" },
  };

  return labels[kind]?.[locale] ?? (locale === "ar" ? "حركة حساب أخرى" : "Other account transaction");
}

export function partyLedgerDescription(
  notes: string | null,
  kind: string,
  invoiceNumber: string | undefined,
  locale: Locale
): string {
  if (!notes) {
    if (kind === "opening") return locale === "ar" ? "رصيد افتتاحي" : "Opening balance";
    if (kind === "payment") {
      return invoiceNumber
        ? locale === "ar" ? `دفعة مرتبطة بالفاتورة رقم ${invoiceNumber}` : `Payment linked to invoice ${invoiceNumber}`
        : locale === "ar" ? "دفعة على الحساب" : "Account payment";
    }
    return invoiceNumber
      ? locale === "ar" ? `قيد الفاتورة رقم ${invoiceNumber}` : `Invoice entry ${invoiceNumber}`
      : locale === "ar" ? "قيد على الحساب" : "Account entry";
  }

  const invoiceTypeLabels: Record<string, { ar: string; en: string }> = {
    sale_return: { ar: "مرتجع مبيعات", en: "sales return" },
    purchase_return: { ar: "مرتجع مشتريات", en: "purchase return" },
    sale: { ar: "بيع", en: "sale" },
    purchase: { ar: "شراء", en: "purchase" },
  };

  return notes
    .replace(/فاتورة\s+(sale_return|purchase_return|sale|purchase)\b/gi, (_match, kind: string) => {
      const label = invoiceTypeLabels[kind.toLowerCase()];
      return locale === "ar" ? `فاتورة ${label.ar}` : `${label.en} invoice`;
    })
    .replace(/\b(sale_return|purchase_return|sale|purchase)\b/gi, (kind) => {
      const label = invoiceTypeLabels[kind.toLowerCase()];
      return locale === "ar" ? label.ar : label.en;
    });
}
