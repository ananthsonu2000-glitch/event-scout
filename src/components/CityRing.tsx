"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { CitySlice } from "@/lib/queries";

// Same brightness in light and dark mode. "Other" is neutral.
const COLORS = ["99 102 241", "14 165 233", "16 185 129", "139 92 246", "148 163 184"];

/** Upcoming events by city as a ring. Click a slice (or a legend row) to filter the list to that city; click again to clear. */
export function CityRing({ slices }: { slices: CitySlice[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [hover, setHover] = useState<string | null>(null);

  const total = slices.reduce((a, s) => a + s.n, 0);
  const selected = sp.get("city");
  const focus = hover ?? selected;

  const pick = (city: string) => {
    if (city === "Other" || city === "Unknown") return;
    const p = new URLSearchParams(sp.toString());
    p.delete("event");
    if (selected === city) p.delete("city");
    else p.set("city", city);
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  let cum = 0;
  const arcs = slices.map((s, i) => {
    const pct = total ? (s.n / total) * 100 : 0;
    const arc = { ...s, pct, start: cum, color: COLORS[Math.min(i, COLORS.length - 1)] };
    cum += pct;
    return arc;
  });
  const center = focus ? slices.find((s) => s.city === focus) : null;

  return (
    <section className="card flex flex-col p-4" aria-label="Upcoming events by city">
      <div>
        <h2 className="section-title">By city</h2>
        <p className="text-xs text-slate-500">Click a city to filter the list.</p>
      </div>

      {total === 0 ? (
        <p className="m-auto py-10 text-sm text-slate-500">No upcoming events to chart.</p>
      ) : (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-4">
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label={`Events by city: ${slices.map((s) => `${s.city} ${s.n}`).join(", ")}`}>
              <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="5" style={{ stroke: "rgb(var(--c-slate-100))" }} />
              {arcs.map((a, i) => (
                <circle
                  key={a.city}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  strokeWidth={focus === a.city ? 6 : 5}
                  pathLength={100}
                  strokeDasharray={`${Math.max(0, a.pct - 0.8)} 100`}
                  strokeDashoffset={-a.start}
                  className="ring-seg chart-hit"
                  style={{ stroke: `rgb(${a.color})`, opacity: focus && focus !== a.city ? 0.3 : 1, ["--d" as string]: `${i * 90}ms`, transition: "opacity .2s, stroke-width .2s" } as React.CSSProperties}
                  onMouseEnter={() => setHover(a.city)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => pick(a.city)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-4xl tabular-nums text-slate-900">{center ? center.n : total}</span>
              <span className="mt-1 max-w-[5.5rem] truncate text-[11px] text-slate-500">{center ? center.city : "events"}</span>
            </div>
          </div>

          <ul className="w-full min-w-0 flex-1 space-y-1">
            {arcs.map((a) => (
              <li key={a.city}>
                <button
                  type="button"
                  onClick={() => pick(a.city)}
                  onMouseEnter={() => setHover(a.city)}
                  onMouseLeave={() => setHover(null)}
                  aria-pressed={selected === a.city}
                  disabled={a.city === "Other" || a.city === "Unknown"}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition ${selected === a.city ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-100"} disabled:cursor-default disabled:hover:bg-transparent`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: `rgb(${a.color})` }} />
                  <span className="min-w-0 flex-1 truncate">{a.city}</span>
                  <span className="tabular-nums text-slate-500">{a.n}</span>
                  <span className="w-9 text-right text-xs tabular-nums text-slate-400">{Math.round(a.pct)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
