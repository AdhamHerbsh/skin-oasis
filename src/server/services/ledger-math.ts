type LedgerTransaction = { kind: string; amount: string | number };
type LedgerEntry = { debit?: string | number | null; credit?: string | number | null };

export function cashboxBalance(opening: string | number, transactions: LedgerTransaction[]) {
  const openingBalance = Number(opening) || 0;
  return transactions.reduce((balance, tx) => {
    const amount = Number(tx.amount) || 0;
    return balance + (["income", "transfer_in", "invoice_payment", "party_payment"].includes(tx.kind) ? amount : -amount);
  }, openingBalance);
}

export function cashboxBalanceAfterRemoving(
  opening: string | number,
  transactions: (LedgerTransaction & { id: string })[],
  removedTransactionIds: string[],
) {
  const removedIds = new Set(removedTransactionIds);
  return cashboxBalance(opening, transactions.filter((transaction) => !removedIds.has(transaction.id)));
}

export function partyBalance(
  openingOrEntries: string | number | LedgerEntry[],
  entriesOrOpening?: LedgerEntry[] | string | number,
  type: "customer" | "supplier" = "customer",
) {
  let openingBalance = 0;
  let ledgerEntries: LedgerEntry[] = [];
  let partyType: "customer" | "supplier" = type;

  if (Array.isArray(openingOrEntries)) {
    ledgerEntries = openingOrEntries;
    openingBalance = Number(entriesOrOpening ?? 0) || 0;
  } else {
    openingBalance = Number(openingOrEntries) || 0;
    ledgerEntries = Array.isArray(entriesOrOpening) ? entriesOrOpening : [];
  }

  if (typeof entriesOrOpening === "string" && (entriesOrOpening === "supplier" || entriesOrOpening === "customer")) {
    partyType = entriesOrOpening;
  }

  return ledgerEntries.reduce((balance, entry) => {
    const debit = Number(entry.debit ?? 0) || 0;
    const credit = Number(entry.credit ?? 0) || 0;
    return balance + (partyType === "customer" ? debit - credit : credit - debit);
  }, openingBalance);
}

export function invoiceStatus(total: number, paid: number) {
  if (total < 0 || paid < 0 || paid > total) throw new Error("INVALID_AMOUNT");
  return paid === 0 ? "unpaid" : paid === total ? "paid" : "partial";
}

export function reverseCashKind(kind: string): "income" | "expense" | null {
  if (["invoice_payment", "income", "transfer_in", "party_payment", "sale_return"].includes(kind)) return "expense";
  if (["expense", "transfer_out", "purchase_return"].includes(kind)) return "income";
  return null;
}

export function restoreEditedInvoiceStock(
  currentStock: number,
  invoiceQuantity: number,
  type: "sale" | "purchase" | "sale_return" | "purchase_return",
) {
  const restored = currentStock + (["sale", "purchase_return"].includes(type) ? invoiceQuantity : -invoiceQuantity);
  if (restored < 0) throw new Error("CANNOT_REVERSE_PURCHASE_STOCK");
  return restored;
}
