import { useEffect } from "react";
import { requestFinanceSync } from "@/lib/finance";

/** Also picks up manual orders and carrier events written through other entry points. */
export function FinanceQueueRunner() {
  useEffect(() => {
    let running = false;
    const run = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        await requestFinanceSync();
      } finally {
        running = false;
      }
    };
    void run();
    const timer = setInterval(() => void run(), 60_000);
    return () => clearInterval(timer);
  }, []);
  return null;
}
