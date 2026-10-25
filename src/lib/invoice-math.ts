export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export type InvoiceDiscountType = "amount" | "percent";

export function calculateInvoiceLineAmounts(
  quantity: number,
  unitPrice: number,
  discountValue: number,
  discountType: InvoiceDiscountType = "amount"
) {
  const discountPerUnit = discountType === "percent"
    ? roundMoney(unitPrice * discountValue / 100)
    : discountValue;
  const subtotal = roundMoney(quantity * unitPrice);
  const total = roundMoney(quantity * (unitPrice - discountPerUnit));
  return {
    subtotal,
    discount: roundMoney(subtotal - total),
    discountPerUnit,
    netUnitPrice: roundMoney(unitPrice - discountPerUnit),
    total,
  };
}

export function calculateInvoiceTotal(
  subtotal: number,
  lineDiscount: number,
  invoiceDiscount: number,
  tax: number
): number {
  return Math.max(0, roundMoney(subtotal - lineDiscount - invoiceDiscount + tax));
}

export function calculateInvoiceStockQuantity(
  quantity: number,
  bonusQuantity: number,
  unitFactor: number
): number {
  return (quantity + bonusQuantity) * unitFactor;
}
