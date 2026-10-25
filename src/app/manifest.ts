import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [brand] = await db
    .select({
      name: settings.organizationName,
      updatedAt: settings.updatedAt,
      locale: settings.locale,
    })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  const name = brand?.name ?? "Apex ERP";
  const shortName = name.slice(0, 12) || "Apex ERP";
  const locale = brand?.locale === "en" ? "en" : "ar";
  const logoVersion = brand?.updatedAt.getTime() ?? 0;

  return {
    name,
    short_name: shortName,
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    lang: locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    icons: [
      { src: `/api/pwa-icon/192?v=${logoVersion}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/api/pwa-icon/512?v=${logoVersion}`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}