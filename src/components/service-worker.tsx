import { useEffect, useState } from "react";

/** Updates are explicit, so a worker never reloads a checkout in progress. */
export function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (!active) return;
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (active && worker.state === "installed" && navigator.serviceWorker.controller)
              setWaiting(worker);
          });
        });
      } catch {
        /* Installation remains optional. */
      }
    };
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      active = false;
      window.removeEventListener("load", register);
    };
  }, []);
  if (!waiting) return null;
  return (
    <aside className="no-print fixed end-3 top-3 z-50 max-w-xs rounded-[12px] border border-outline bg-surface p-3 text-sm shadow-lg">
      <p>Une mise à jour Elegancia Home est disponible.</p>
      <button
        type="button"
        className="btn btn-primary btn-sm mt-2"
        onClick={() => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => window.location.reload(),
            { once: true },
          );
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Actualiser maintenant
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWaiting(null)}>
        Plus tard
      </button>
    </aside>
  );
}
