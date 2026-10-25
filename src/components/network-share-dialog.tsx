"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, X, QrCode } from "lucide-react";
import QRCodeLib from "qrcode";
import { useI18n } from "@/lib/i18n-client";

interface NetworkShareDialogProps {
  networkUrl: string;
  className?: string;
  buttonLabel?: string;
}

export function NetworkShareDialog({
  networkUrl,
  className = "",
  buttonLabel,
}: NetworkShareDialogProps) {
  const { locale, isRtl } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(networkUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const handleOpen = () => {
    const { hostname, host, protocol } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.startsWith("172.18.")) {
      setDisplayUrl(`${protocol}//${host}`);
    } else if (networkUrl && networkUrl.includes("172.18.")) {
      setDisplayUrl("http://172.20.10.2:3000");
    } else if (networkUrl) {
      setDisplayUrl(networkUrl);
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (displayUrl) {
      QRCodeLib.toDataURL(displayUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: "#1e1b4b",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code generation error:", err));
    }
  }, [displayUrl]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-[var(--line-strong)] hover:bg-[var(--bg)] hover:text-[var(--primary)] text-[var(--ink-secondary)] ${className}`}
        title={locale === "en" ? "Show QR code" : "عرض رمز QR"}
        aria-label={locale === "en" ? "Show QR code" : "عرض رمز QR"}
      >
        <Wifi size={14} className="text-emerald-600" />
        <span>{buttonLabel ?? (locale === "en" ? "Show QR" : "عرض QR")}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--backdrop)]">
          <div
            className={`relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--modal-bg)] border border-[var(--modal-border)] p-5 sm:p-6 shadow-2xl text-[var(--ink)] ${isRtl ? "text-right" : "text-left"}`}
            dir={isRtl ? "rtl" : "ltr"}
            role="dialog"
            aria-modal="true"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 left-4 p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
              aria-label={locale === "en" ? "Close" : "إغلاق"}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <Wifi size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--ink)]">
                  {locale === "en" ? "Open the app on another device" : "فتح السيستم على جهاز آخر"}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {locale === "en" ? "Scan the QR code with another device to open the app" : "امسح رمز QR من الجهاز الآخر لفتح السيستم"}
                </p>
              </div>
            </div>

            {/* Crisp Scannable QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-indigo-100 shadow-xs mb-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={locale === "en" ? "QR code to open the app" : "QR Code لفتح السيستم"}
                  className="w-48 h-48 rounded-xl object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-slate-50 rounded-xl text-xs text-slate-400 font-bold">
                  {locale === "en" ? "Generating QR code..." : "جاري تجهيز الباركود..."}
                </div>
              )}
              <span className="text-[11px] font-bold text-slate-700 mt-2 flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                <QrCode size={13} className="text-indigo-600" />
                <span>{locale === "en" ? "Scan with your phone camera to open the app" : "امسح بكاميرا الموبايل للدخول الفوري"}</span>
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-[var(--ink-secondary)] mb-4">
              <Smartphone size={15} className="text-indigo-600 shrink-0" />
              <span>{locale === "en" ? "Use another device's camera to scan the code." : "استخدم كاميرا الجهاز الآخر لمسح الرمز."}</span>
            </div>

            {/* Bottom Button */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="secondary w-full py-2.5 text-xs font-bold rounded-xl"
              >
                {locale === "en" ? "Close" : "إغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
