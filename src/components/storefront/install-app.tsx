import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n-context";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const copy = {
  fr: ["Installer Elegancia Home", "Sur iPhone : Partager → Sur l’écran d’accueil.", "Plus tard"],
  ar: ["تثبيت إليغانسيا هوم", "على آيفون: مشاركة ← إضافة إلى الشاشة الرئيسية.", "لاحقًا"],
  en: ["Install Elegancia Home", "On iPhone: Share → Add to Home Screen.", "Later"],
};
export function InstallApp() {
  const { locale } = useI18n();
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    )
      return;
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const installed = () => {
      setPrompt(null);
      setIos(false);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (dismissed || (!prompt && !ios)) return null;
  const labels = copy[locale];
  return (
    <aside className="no-print mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2 px-4 py-3 text-xs">
      {prompt ? (
        <button
          type="button"
          className="text-primary underline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await prompt.prompt();
              await prompt.userChoice;
              setDismissed(true);
            } catch {
              setPrompt(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          {labels[0]}
        </button>
      ) : (
        <details>
          <summary>{labels[0]}</summary>
          <p>{labels[1]}</p>
        </details>
      )}
      <button
        type="button"
        className="p-2 text-on-surface-muted"
        onClick={() => setDismissed(true)}
      >
        {labels[2]}
      </button>
    </aside>
  );
}
