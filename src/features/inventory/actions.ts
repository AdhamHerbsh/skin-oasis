"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { categories, products, stockMovements, units } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { zUuid, zOptionalUuid } from "@/lib/validation";

const productSchema = z.object({
  id: zOptionalUuid,
  name: z.string().trim().min(2).max(180),
  sku: z.string().trim().max(80).optional().or(z.literal("")),
  skuAuto: z.enum(["on", "off"]).optional(),
  barcode: z.string().trim().max(100).optional().or(z.literal("")),
  categoryId: zOptionalUuid,
  unitId: zOptionalUuid,
  costPrice: z.coerce.number().finite().min(0),
  salePrice: z.coerce.number().finite().min(0),
  stock: z
    .preprocess((val) => (val === "" || val === undefined || val === null ? 0 : val), z.coerce.number().finite().min(0))
    .optional()
    .default(0),
  reorderLevel: z
    .preprocess((val) => (val === "" || val === undefined || val === null ? 5 : val), z.coerce.number().finite().min(0))
    .optional()
    .default(5),
  active: z.enum(["on", "off"]).optional(),
});

export async function saveProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const userId = await requirePermission("inventory", id ? "edit" : "create");
  const rawData = Object.fromEntries(formData);
  const parsed = productSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(`INVALID_PRODUCT: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  const input = parsed.data;
  const finalSku = (input.sku || "").trim();
  const values = {
    name: input.name,
    barcode: input.barcode || null,
    categoryId: input.categoryId || null,
    unitId: input.unitId || null,
    costPrice: input.costPrice.toFixed(2),
    salePrice: input.salePrice.toFixed(2),
    reorderLevel: String(input.reorderLevel),
    active: input.active !== "off",
  };

  try {
    await db.transaction(async (tx) => {
      if (input.categoryId) {
        const [category] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.id, input.categoryId), isNull(categories.deletedAt)))
          .for("update")
          .limit(1);
        if (!category) throw new Error("CATEGORY_NOT_FOUND");
      }
      if (input.unitId) {
        const [unit] = await tx
          .select({ id: units.id })
          .from(units)
          .where(eq(units.id, input.unitId))
          .for("update")
          .limit(1);
        if (!unit) throw new Error("UNIT_NOT_FOUND");
      }

      if (id) {
        if (!finalSku) throw new Error("PRODUCT_SKU_REQUIRED");
        const updated = await tx
          .update(products)
          .set({ ...values, sku: finalSku })
          .where(and(eq(products.id, id), isNull(products.deletedAt)))
          .returning({ id: products.id });
        if (!updated.length) throw new Error("PRODUCT_NOT_FOUND");
      } else {
        let sku = finalSku;
        if (input.skuAuto === "on" || !sku) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext('product_sku_generation'))`);
          const existingSkus = await tx.select({ sku: products.sku }).from(products);
          const maxSequence = existingSkus.reduce((max, row) => {
            const match = row.sku.match(/^SKN-(\d+)$/i);
            return match ? Math.max(max, Number(match[1])) : max;
          }, 0);
          sku = `SKN-${String(maxSequence + 1).padStart(3, "0")}`;
        }

        const [product] = await tx
          .insert(products)
          .values({ ...values, sku, stock: String(input.stock) })
          .returning({ id: products.id });
        if (input.stock > 0) {
          await tx.insert(stockMovements).values({
            productId: product.id,
            type: "adjustment",
            quantity: String(input.stock),
            reason: "رصيد افتتاحي عند إنشاء المنتج",
            userId,
          });
        }
      }
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "product_sku_uq"
    ) {
      throw new Error("PRODUCT_SKU_EXISTS");
    }
    throw error;
  }
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  await requirePermission("inventory", "delete");
  const id = zUuid.parse(formData.get("id"));
  const deleted = await db
    .update(products)
    .set({ active: false, deletedAt: new Date() })
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning({ id: products.id });
  if (!deleted.length) throw new Error("PRODUCT_NOT_FOUND");
  revalidatePath("/inventory");
  revalidatePath("/");
}

const adjustmentSchema = z.object({ productId: zUuid, quantity: z.number().finite().refine((n) => n !== 0), reason: z.string().trim().min(4) });
export async function adjustStock(raw: unknown) {
  const userId = await requirePermission("inventory", "edit");
  const input = adjustmentSchema.parse(raw);
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, input.productId)).for("update").limit(1);
    if (!p) throw new Error("PRODUCT_NOT_FOUND");
    if (Number(p.stock) + input.quantity < 0) throw new Error("NEGATIVE_STOCK");
    await tx.update(products).set({ stock: String(Number(p.stock) + input.quantity) }).where(eq(products.id, p.id));
    await tx.insert(stockMovements).values({ productId: p.id, type: "adjustment", quantity: String(Math.abs(input.quantity)), reason: input.reason, userId });
  });
  revalidatePath("/"); revalidatePath("/inventory");
  return { ok: true };
}

export async function adjustStockFromForm(formData: FormData) {
  const quantity = Number(formData.get("quantity"));
  await adjustStock({ productId: String(formData.get("productId")), quantity, reason: String(formData.get("reason") ?? "") });
}

export async function createCategory(formData: FormData) {
  await requirePermission("inventory", "create");
  const name = z.string().trim().min(2).max(120).parse(formData.get("name"));
  await db.insert(categories).values({ name });
  revalidatePath("/inventory");
}

export async function updateCategory(formData: FormData) {
  await requirePermission("inventory", "edit");
  const id = zUuid.parse(formData.get("id"));
  const name = z.string().trim().min(2).max(120).parse(formData.get("name"));
  await db.update(categories).set({ name }).where(eq(categories.id, id));
  revalidatePath("/inventory");
}

export async function deleteCategory(formData: FormData) {
  await requirePermission("inventory", "delete");
  const id = zUuid.parse(formData.get("id"));
  await db.transaction(async (tx) => {
    const [category] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .for("update")
      .limit(1);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    await tx.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
    await tx.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, id));
  });
  revalidatePath("/inventory");
}

export async function createUnit(formData: FormData) {
  await requirePermission("inventory", "create");
  const name = z.string().trim().min(1).max(80).parse(formData.get("name"));
  const factor = z.coerce.number().positive().parse(formData.get("factor") ?? 1);
  await db.insert(units).values({ name, factor: String(factor) });
  revalidatePath("/inventory");
}

export async function updateUnit(formData: FormData) {
  await requirePermission("inventory", "edit");
  const id = zUuid.parse(formData.get("id"));
  const name = z.string().trim().min(1).max(80).parse(formData.get("name"));
  const factor = z.coerce.number().positive().parse(formData.get("factor") ?? 1);
  await db.update(units).set({ name, factor: String(factor) }).where(eq(units.id, id));
  revalidatePath("/inventory");
}

export async function deleteUnit(formData: FormData) {
  await requirePermission("inventory", "delete");
  const id = zUuid.parse(formData.get("id"));
  await db.transaction(async (tx) => {
    const [unit] = await tx.select({ id: units.id }).from(units).where(eq(units.id, id)).for("update").limit(1);
    if (!unit) throw new Error("UNIT_NOT_FOUND");
    await tx.update(products).set({ unitId: null }).where(eq(products.unitId, id));
    await tx.delete(units).where(eq(units.id, unit.id));
  });
  revalidatePath("/inventory");
}
