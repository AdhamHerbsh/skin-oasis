"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download } from "lucide-react";
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
  const [message, setMessage] = useState("");
  const isInstalled = useSyncExternalStore(subscribeToStandalone, isStandalone, () => false) || appInstalled;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setMessage("");
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setAppInstalled(true);
      setMessage(locale === "ar" ? "تم تثبيت التطبيق." : "App installed.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [locale]);

  const handleInstall = async () => {
    if (!installPrompt) {
      setMessage(
        locale === "ar"
          ? "من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."
          : "Use the browser menu to choose Install app or Add to Home Screen."
      );
      return;
    }

    try {
      const prompt = installPrompt;
      setInstallPrompt(null);
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setAppInstalled(true);
        setMessage(locale === "ar" ? "تم تثبيت التطبيق." : "App installed.");
      }
    } catch {
      setMessage(
        locale === "ar"
          ? "استخدم قائمة المتصفح لتثبيت التطبيق أو إضافته إلى الشاشة الرئيسية."
          : "Use the browser menu to install the app or add it to your home screen."
      );
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="secondary inline-flex items-center gap-1.5" onClick={handleInstall} disabled={isInstalled}>
        {isInstalled ? <Check size={16} /> : <Download size={16} />}
        <span>
          {isInstalled
            ? locale === "ar" ? "تم التثبيت" : "Installed"
            : locale === "ar" ? "تنزيل التطبيق" : "Install app"}
        </span>
      </button>
      {message && <span className="text-[10px] text-[var(--muted)] text-right" role="status">{message}</span>}
    </div>
  );
}