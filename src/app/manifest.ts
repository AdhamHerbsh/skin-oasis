import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { localLogoUrl } from "@/server/services/branding";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [brand] = await db
    .select({ name: settings.organizationName, logo: settings.logoPath, locale: settings.locale })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  const name = brand?.name ?? "Apex ERP";
  const shortName = name.slice(0, 12) || "Apex ERP";
  const logo = localLogoUrl(brand?.logo) ?? "/pwa-icon.svg";
  const locale = brand?.locale === "en" ? "en" : "ar";

  const extension = logo.split("?")[0].split(".").pop()?.toLowerCase();
  const type =
    extension === "png"
      ? "image/png"
      : extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : extension === "webp"
          ? "image/webp"
          : "image/svg+xml";

  return {
    name,
    short_name: shortName,
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    lang: locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    icons: [{ src: logo, sizes: "any", type, purpose: "any" }],
  };
}