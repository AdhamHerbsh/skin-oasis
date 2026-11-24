"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/permissions";
import { createInvoice, deleteInvoice, updateInvoice } from "@/server/services/invoices";
import { zUuid, zOptionalUuid } from "@/lib/validation";

const schema = z.object({
  id: zOptionalUuid,
  type: z.enum(["sale", "purchase", "sale_return", "purchase_return"]),
  partyId: zUuid.or(z.literal("")),
  cashboxId: zUuid.or(z.literal("")),
  paid: z.coerce.number().finite().min(0),
  discount: z.coerce.number().finite().min(0),
  tax: z.coerce.number().finite().min(0),
  lines: z
    .array(
      z.object({
        productId: zUuid,
        quantity: z.string().regex(/^\d+(\.\d{1,3})?$/),
        bonusQuantity: z.string().regex(/^\d+(\.\d{1,3})?$/),
        unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        discountValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
        discountType: z.enum(["amount", "percent"]),
        unitName: z.string().optional(),
        unitFactor: z.string().optional(),
      })
    )
    .min(1),
});
export async function saveInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let invoiceId: string | null = null;
  try {
    const userId = await requirePermission("invoices", id ? "edit" : "create");
    let lines: unknown;
    try {
      lines = JSON.parse(String(formData.get("lines") ?? "[]")) as unknown;
    } catch {
      return { ok: false, code: "INVALID_INVOICE_LINES", message: "تعذر قراءة أصناف الفاتورة" };
    }
    const parsed = schema.safeParse({
      id,
      type: formData.get("type"),
      partyId: formData.get("partyId") ?? "",
      cashboxId: formData.get("cashboxId") ?? "",
      paid: formData.get("paid"),
      discount: formData.get("discount") ?? 0,
      tax: formData.get("tax") ?? 0,
      lines,
    });
    if (!parsed.success) {
      return { ok: false, code: "INVALID_INVOICE", message: JSON.stringify(parsed.error.flatten().fieldErrors) };
    }
    const input = {
      ...parsed.data,
      partyId: parsed.data.partyId || null,
      cashboxId: parsed.data.cashboxId || null,
      paid: String(parsed.data.paid),
      discount: String(parsed.data.discount),
      tax: String(parsed.data.tax),
    };
    const invoice = id ? await updateInvoice(id, input, userId) : await createInvoice(input, userId);
    invoiceId = invoice.id;
    revalidatePath("/invoices");
    revalidatePath("/parties");
    revalidatePath("/finance");
    revalidatePath("/inventory");
    revalidatePath("/", "layout");
  } catch (error) {
    let root: unknown = error;
    for (let depth = 0; depth < 4 && root && typeof root === "object"; depth++) {
      const cause = (root as { cause?: unknown }).cause;
      if (!cause) break;
      root = cause;
    }
    const message = root instanceof Error ? root.message : error instanceof Error ? error.message : String(error);
    const code =
      root && typeof root === "object" && "code" in root
        ? String((root as { code: unknown }).code)
        : message.includes(":")
          ? message.split(":")[0]
          : message;
    console.error("Invoice save failed", { code, message, error });
    return { ok: false, code, message };
  }
  redirect(`/invoices/${invoiceId!}`);
}

export async function removeInvoice(formData: FormData) {
  try {
    const userId = await requirePermission("invoices", "delete");
    const parsed = zUuid.safeParse(formData.get("id"));
    if (!parsed.success) {
      return { ok: false, code: "INVALID_INVOICE", message: "معرف الفاتورة غير صالح" };
    }
    await deleteInvoice(parsed.data, userId);
    revalidatePath("/invoices");
    revalidatePath("/parties");
    revalidatePath("/finance");
    revalidatePath("/inventory");
    revalidatePath("/reports");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    let root: unknown = error;
    for (let depth = 0; depth < 4 && root && typeof root === "object"; depth++) {
      const cause = (root as { cause?: unknown }).cause;
      if (!cause) break;
      root = cause;
    }
    const message = root instanceof Error ? root.message : error instanceof Error ? error.message : String(error);
    const code =
      root && typeof root === "object" && "code" in root
        ? String((root as { code: unknown }).code)
        : message.includes(":")
          ? message.split(":")[0]
          : message;
    console.error("Invoice delete failed", { code, message, error });
    return { ok: false, code, message };
  }
}
