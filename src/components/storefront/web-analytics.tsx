import { setAnalyticsAdapter } from "@/lib/analytics-events";
import { analyticsUrl } from "@/lib/analytics-url";
import { inject, track } from "@vercel/analytics";
import { useEffect } from "react";

export function WebAnalytics() {
  useEffect(() => {
    if (!import.meta.env.PROD || import.meta.env.VITE_WEB_ANALYTICS_ENABLED !== "true") return;
    inject({
      beforeSend: (event) => {
        const url = analyticsUrl(event.url);
        return url ? { ...event, url } : null;
      },
    });
    setAnalyticsAdapter((event, properties) => track(event, properties));
    return () => setAnalyticsAdapter(undefined);
  }, []);
  return null;
}
