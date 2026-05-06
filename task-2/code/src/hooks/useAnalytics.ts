import { useCallback, useEffect } from "react";

type Props = Record<string, unknown> | undefined;

/**
 * Lightweight, analytics-ready event tracking hook.
 * Forwards events to window.analytics (Segment-style) or window.dataLayer (GTM)
 * if present, otherwise no-ops in production and logs in dev.
 */
export const useAnalytics = () => {
  const track = useCallback((name: string, props?: Props) => {
    try {
      const w = window as any;
      if (w.analytics?.track) w.analytics.track(name, props);
      else if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: name, ...props });
      else if (import.meta.env.DEV) console.debug("[track]", name, props ?? {});
    } catch {
      /* swallow */
    }
  }, []);

  const page = useCallback((name?: string, props?: Props) => {
    try {
      const w = window as any;
      if (w.analytics?.page) w.analytics.page(name, props);
      else if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: "page_view", page: name, ...props });
      else if (import.meta.env.DEV) console.debug("[page]", name, props ?? {});
    } catch {
      /* swallow */
    }
  }, []);

  return { track, page };
};

export const usePageView = (name: string, props?: Props) => {
  const { page } = useAnalytics();
  useEffect(() => { page(name, props); /* eslint-disable-next-line */ }, [name]);
};
