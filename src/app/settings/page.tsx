import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Palette, CheckCircle2, AlertCircle } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { settings, users } from "@/server/db/schema";
import { saveAppearance, saveSettings } from "@/features/settings/actions";
import { requirePermission } from "@/server/permissions";
import { localLogoUrl } from "@/server/services/branding";
import { Locale, translate } from "@/lib/i18n";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("settings", "view");

  const { error, saved } = await searchParams;

  const [[row], [user]] = await Promise.all([
    db.select().from(settings).where(eq(settings.id, 1)).limit(1),
    db.select({ theme: users.theme, accent: users.accent }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const logoUrl = localLogoUrl(row?.logoPath);
  const locale = (row?.locale === "en" ? "en" : "ar") as Locale;
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">{text("إدارة النظام والهوية", "System and branding management")}</p>
          <h1>{translate("settings.title", locale)}</h1>
        </div>
        <Link className="secondary" href="/">
          <ArrowRight size={15} />
          <span>{translate("common.home", locale)}</span>
        </Link>
      </header>

      {/* Feedback Messages */}
      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 text-xs font-bold mb-4">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{text("تم حفظ وتحديث بيانات وشعار المؤسسة بنجاح!", "Organization details and logo saved successfully.")}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5 text-xs font-bold mb-4">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span>
            {error === "too_large"
              ? text("حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 10 ميجابايت.", "The image is too large. Choose an image smaller than 10 MB.")
              : error === "invalid_format"
              ? text("صيغة الملف غير مدعومة. يرجى استخدام صورة بصيغة PNG أو JPG أو WebP.", "Unsupported file format. Use a PNG, JPG, or WebP image.")
              : text("حدث خطأ أثناء قراءة ملف الصورة. يرجى التأكد من سلامة الملف والمحاولة مرة أخرى.", "Could not read the image. Check that the file is valid and try again.")}
          </span>
        </div>
      )}

      {/* Organization Identity Settings */}
      <section className="panel settings-panel">
        <div className="panel-title">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600" />
            <div>
              <h3>{text("بيانات المؤسسة والفواتير", "Organization and invoice details")}</h3>
              <p>{text("اسم المتجر، العملة، الضريبة، والشعار المطبوع على الفواتير والسندات", "Store name, currency, tax, and the logo printed on invoices and receipts")}</p>
            </div>
          </div>
        </div>

        <form action={saveSettings} className="form-grid">
          <label>
            {translate("settings.orgName", locale)}
            <input name="organizationName" defaultValue={row?.organizationName ?? "لمسة جمال"} required />
          </label>
          <label>
            {text("لغة الواجهة والاتجاه", "Interface language and direction")}
            <select name="locale" defaultValue={row?.locale ?? "ar"}>
              <option value="ar">{text("العربية (RTL) • Arabic", "Arabic (RTL)")}</option>
              <option value="en">{text("الإنجليزية (LTR)", "English (LTR)")}</option>
            </select>
          </label>
          <label>
            {translate("settings.currency", locale)}
            <input name="currency" defaultValue={row?.currency ?? "EGP"} required maxLength={8} />
          </label>
          <label>
            {text("رقم هاتف المتجر (يظهر في الفواتير)", "Store phone number (shown on invoices)")}
            <input name="phone" type="tel" defaultValue={row?.phone ?? ""} maxLength={40} placeholder={text("مثال: 01012345678 أو +20 10 1234 5678", "e.g., 01012345678 or +20 10 1234 5678")} />
          </label>
          <input type="hidden" name="taxRate" value="0" />
          <label className="wide-field">
            {text("شعار المتجر (PNG / JPG / WebP • حتى 10MB)", "Store logo (PNG / JPG / WebP • up to 10 MB)")}
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
          {row?.logoPath && (
            <div className="wide-field flex items-center gap-3 p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
              <span className="global-logo" style={{ backgroundImage: `url("${logoUrl}")` }} />
              <div>
                <b className="text-xs text-[var(--ink)] block">{text("الشعار الحالي للمؤسسة", "Current organization logo")}</b>
                <span className="text-xs text-[var(--muted)]">{text("يظهر في ترويسة الفواتير وشريط التنقل", "Shown in invoice headers and the navigation bar")}</span>
              </div>
            </div>
          )}
          <label className="wide-field">
            {text("نص تذييل الفاتورة (ملاحظات ختامية للعميل)", "Invoice footer (closing note for the customer)")}
            <textarea
              name="invoiceFooter"
              rows={3}
              defaultValue={row?.invoiceFooter ?? ""}
              placeholder={text("مثال: البضاعة المباعة لا ترد ولا تستبدل بعد 14 يومًا • شكرًا لتعاملكم معنا", "Example: Goods sold cannot be returned or exchanged after 14 days • Thank you for your business")}
            />
          </label>
          <button className="primary" type="submit">
            {translate("settings.save", locale)}
          </button>
        </form>
      </section>

      {/* Appearance & Color Palette Settings */}
      <section className="panel">
        <div className="panel-title">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-indigo-600" />
            <div>
              <h3>{translate("settings.appearance", locale)}</h3>
              <p>{text("تخصيص السمة المرئية ونظام الألوان لحسابك الحالي", "Customize the visual theme and color palette for your account")}</p>
            </div>
          </div>
        </div>

        <form action={saveAppearance} className="form-grid">
          <label>
            {text("نمط السمة (Theme)", "Theme")}
            <select name="theme" defaultValue={user?.theme ?? "system"}>
              <option value="system">{text("حسب إعدادات نظام الجهاز", "Use device settings")}</option>
              <option value="light">{text("النمط الفاتح (Light Mode)", "Light mode")}</option>
              <option value="dark">{text("النمط الداكن (Dark Mode)", "Dark mode")}</option>
            </select>
          </label>
          <label>
            {text("مجموعة ألوان التطبيق (Accent Color)", "Application accent color")}
            <select
              name="accent"
              defaultValue={
                user?.accent === "rose" || user?.accent === "berry"
                  ? "indigo"
                  : user?.accent ?? "indigo"
              }
            >
              <option value="indigo">{text("نيلي كلاسيكي • موصى به", "Classic Indigo • Recommended")}</option>
              <option value="ocean">{text("أزرق محيطي", "Ocean Blue")}</option>
              <option value="sage">{text("أخضر زمردي هادئ", "Emerald Sage")}</option>
              <option value="gold">{text("ذهبي كهرماني", "Amber Gold")}</option>
              <option value="slate">{text("رمادي صناعي داكن", "Industrial Slate")}</option>
            </select>
          </label>
          <button className="primary" type="submit">
            {text("تطبيق وحفظ المظهر", "Apply and save appearance")}
          </button>
        </form>
      </section>
    </main>
  );
}
