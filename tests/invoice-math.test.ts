import { describe, expect, it } from "vitest";
import {
  calculateInvoiceLineAmounts,
  calculateInvoiceStockQuantity,
  calculateInvoiceTotal,
} from "../src/lib/invoice-math";

describe("invoice line pricing", () => {
  it("calculates each line with its own per-unit discount", () => {
    const first = calculateInvoiceLineAmounts(3, 100, 10);
    const second = calculateInvoiceLineAmounts(2, 50, 5);

    expect(first).toMatchObject({ subtotal: 300, discount: 30, total: 270 });
    expect(second).toMatchObject({ subtotal: 100, discount: 10, total: 90 });
    expect(calculateInvoiceTotal(400, 40, 15, 0)).toBe(345);
  });

  it("supports percentage discounts per item", () => {
    const line = calculateInvoiceLineAmounts(2, 80, 12.5, "percent");

    expect(line).toMatchObject({
      subtotal: 160,
      discount: 20,
      discountPerUnit: 10,
      netUnitPrice: 70,
      total: 140,
    });
  });

  it("rounds line totals to currency precision and applies invoice tax", () => {
    const line = calculateInvoiceLineAmounts(3, 10, 0.33);

    expect(line).toMatchObject({ subtotal: 30, discount: 0.99, total: 29.01 });
    expect(calculateInvoiceTotal(line.subtotal, line.discount, 2, 1.5)).toBe(28.51);
  });

  it("includes bonus quantities in stock deductions without charging for them", () => {
    expect(calculateInvoiceStockQuantity(2, 1, 12)).toBe(36);
    expect(calculateInvoiceLineAmounts(2, 40, 5).total).toBe(70);
  });
});
