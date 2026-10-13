"use client";

import { Clock, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { timeAgo } from "@/lib/ui";

const INTERVAL_MS = 5 * 60_000;

/**
 * Keeps the dashboard fresh: re-fetches the page data every 5 minutes while the tab is visible (and when you come back
 * to the tab after a while), with a manual refresh button. Filters and scroll position are kept.
 */
export function AutoRefresh({ lastRunEpoch }: { lastRunEpoch: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());
  const [, tick] = useState(0);

  const refresh = useCallback(() => {
    start(() => router.refresh());
    setLastRefresh(Date.now());
  }, [router]);

  useEffect(() => {
    const every = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, INTERVAL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 30_000); // keep "x min ago" current
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh > INTERVAL_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(every);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, lastRefresh]);

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden items-center gap-1.5 sm:flex" title="Time of the most recent scraper run" suppressHydrationWarning>
        <Clock size={13} aria-hidden /> Last scrape {timeAgo(lastRunEpoch)}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="btn-secondary !py-1 !text-xs"
        aria-label="Refresh data"
        title="Refreshes automatically every 5 minutes"
      >
        {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCw size={13} aria-hidden />}
        <span suppressHydrationWarning>{pending ? "Refreshing" : `Updated ${timeAgo(lastRefresh)}`}</span>
      </button>
    </div>
  );
}
