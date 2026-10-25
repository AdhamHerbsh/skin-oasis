import type { Locale } from "@/lib/i18n";

export function formatAmount(value: number | string, locale: Locale = "en") {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 }).format(
    Number.isFinite(amount) ? amount : 0
  );
}

export function formatAmountInput(value: number) {
  return (Math.round(value * 100) / 100).toString();
}
