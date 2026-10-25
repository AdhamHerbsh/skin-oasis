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
  const isInstalled = useSyncExternalStore(subscribeToStandalone, isStandalone, () => false) || appInstalled;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
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

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="secondary inline-flex items-center gap-1.5" onClick={handleInstall} disabled={isInstalled}>
        {isInstalled ? <Check size={16} /> : <Download size={16} />}
        <span>
          {isInstalled
            ? locale === "ar" ? "تم التثبيت" : "Installed"
            : locale === "ar" ? "تثبيت الموقع" : "Install website"}
        </span>
      </button>
    </div>
  );
}