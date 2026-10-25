"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n-client";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const standaloneQuery = "(display-mode: standalone)";

function subscribeToStandalone(callback: () => void) {
  const mediaQuery = window.matchMedia(standaloneQuery);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function isStandalone() {
  return (
    window.matchMedia(standaloneQuery).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallButton() {
  const { locale } = useI18n();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [removalInstructions, setRemovalInstructions] = useState("");
  const isInstalled = useSyncExternalStore(subscribeToStandalone, isStandalone, () => false) || appInstalled;

  useEffect(() => {
    if (!removalInstructions) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRemovalInstructions("");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removalInstructions]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setAppInstalled(false);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setAppInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    try {
      const prompt = installPrompt;
      setInstallPrompt(null);
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setAppInstalled(true);
      }
    } catch (error) {
      console.error("Website installation failed:", error);
    }
  };

  const handleRemove = () => {
    const userAgent = navigator.userAgent;
    setRemovalInstructions(
      locale === "ar"
        ? /iPhone|iPad|iPod/i.test(userAgent)
          ? "اضغط مطولًا على أيقونة الموقع في الشاشة الرئيسية، ثم اختر إزالة الإشارة المرجعية أو حذف التطبيق."
          : /Android/i.test(userAgent)
            ? "اضغط مطولًا على أيقونة الموقع، ثم اختر إزالة التطبيق."
            : "افتح قائمة التطبيقات المثبتة في المتصفح، واختر إزالة هذا التطبيق."
        : /iPhone|iPad|iPod/i.test(userAgent)
          ? "Touch and hold the website icon on your Home Screen, then choose Remove Bookmark or Delete App."
          : /Android/i.test(userAgent)
            ? "Touch and hold the website icon, then choose Uninstall."
            : "Open your browser's installed apps list and choose to remove this app."
    );
  };

  return (
    <>
      <button
        type="button"
        className="secondary inline-flex items-center gap-1.5"
        onClick={isInstalled ? handleRemove : handleInstall}
      >
        {isInstalled ? <Trash2 size={16} /> : <Download size={16} />}
        <span>
          {isInstalled
            ? locale === "ar" ? "إزالة التطبيق" : "Remove app"
            : locale === "ar" ? "تثبيت الموقع" : "Install website"}
        </span>
      </button>
      {removalInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4"
          onClick={() => setRemovalInstructions("")}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-removal-title"
            className="relative w-full max-w-sm rounded-2xl border border-[var(--modal-border)] bg-[var(--modal-bg)] p-5 text-[var(--ink)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setRemovalInstructions("")}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--bg)]"
              aria-label={locale === "ar" ? "إغلاق" : "Close"}
            >
              <X size={18} />
            </button>
            <h2 id="pwa-removal-title" className="mb-3 pe-8 text-base font-bold">
              {locale === "ar" ? "إزالة التطبيق" : "Remove app"}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">
              {removalInstructions}
            </p>
          </section>
        </div>
      )}
    </>
  );
}