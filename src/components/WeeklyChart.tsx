"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Bucket } from "@/lib/queries";

const RANGES: { key: 7 | 30 | 90; label: string }[] = [
  { key: 7, label: "7D" },
  { key: 30, label: "30D" },
  { key: 90, label: "90D" },
];

const W = 640;
const H = 210;
const PAD = { l: 30, r: 8, t: 14, b: 28 };

/**
 * Upcoming events by period, stacked by priority. Click a segment to filter the list to that period and priority,
 * click the empty column space for the period only. The 7D/30D/90D pills re-draw the chart.
 */
export function WeeklyChart({ buckets, range }: { buckets: Bucket[]; range: 7 | 30 | 90 }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [hover, setHover] = useState<number | null>(null);

  const total = buckets.reduce((a, b) => a + b.high + b.medium, 0);
  const max = Math.max(2, ...buckets.map((b) => b.high + b.medium));
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const band = plotW / buckets.length;
  const barW = Math.min(46, band * 0.62);
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
  const ticks = [0, Math.round(max / 2), max];
  const selFrom = sp.get("from");
  const selTo = sp.get("to");
  const selPriority = sp.get("priority");

  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("event");
    p.delete("range");
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  const pick = (b: Bucket, priority?: "High" | "Medium") => {
    const same = selFrom === b.from && selTo === b.to && (selPriority ?? "") === (priority ?? "");
    push(same ? { from: null, to: null, priority: null } : { from: b.from, to: b.to, priority: priority ?? null });
  };

  const hb = hover !== null ? buckets[hover] : null;

  return (
    <section className="card p-4" aria-label="Upcoming events by priority">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">Upcoming events</h2>
          <p className="text-xs text-slate-500">
            {total} High and Medium in the next {range} days. Click a bar to filter the list.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-slate-500 sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(var(--chart-high))" }} /> High
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(var(--chart-medium))" }} /> Medium
            </span>
          </div>
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Chart range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={range === r.key}
                onClick={() => push({ cr: r.key === 30 ? null : String(r.key), from: null, to: null, priority: null })}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${range === r.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-3" onMouseLeave={() => setHover(null)}>
        {hb && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lift"
            style={{ left: `${((PAD.l + band * (hover! + 0.5)) / W) * 100}%` }}
            role="status"
          >
            <p className="font-semibold">{hb.from === hb.to ? hb.label : `${hb.label} week`}</p>
            <p>
              {hb.high} High, {hb.medium} Medium
            </p>
          </div>
        )}

        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Bar chart of upcoming High and Medium events, ${total} in total`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 4"} style={{ stroke: "rgb(var(--c-slate-200))" }} />
              <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={10} style={{ fill: "rgb(var(--c-slate-400))" }}>
                {t}
              </text>
            </g>
          ))}

          <g key={`${range}-${total}`}>
            {buckets.map((b, i) => {
              const cx = PAD.l + band * (i + 0.5);
              const x = cx - barW / 2;
              const hh = (v: number) => (v / max) * plotH;
              const selected = selFrom === b.from && selTo === b.to;
              const dim = (selFrom || selPriority) && !selected && selFrom ? 0.35 : 1;
              const delay = { ["--d" as string]: `${i * 35}ms` } as React.CSSProperties;
              return (
                <g key={b.from} opacity={dim} style={{ transition: "opacity .2s" }}>
                  {/* whole column: filter by period only */}
                  <rect
                    x={cx - band / 2}
                    y={PAD.t}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    className="chart-hit"
                    tabIndex={0}
                    role="button"
                    aria-label={`${b.label}: ${b.high} High, ${b.medium} Medium. Filter list to this period`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onClick={() => pick(b)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(b))}
                  />
                  {b.medium > 0 && (
                    <rect
                      x={x}
                      y={y(b.medium)}
                      width={barW}
                      height={hh(b.medium)}
                      rx={3}
                      className="bar chart-hit"
                      style={{ ...delay, fill: "rgb(var(--chart-medium))" }}
                      onMouseEnter={() => setHover(i)}
                      onClick={(e) => (e.stopPropagation(), pick(b, "Medium"))}
                    />
                  )}
                  {b.high > 0 && (
                    <rect
                      x={x}
                      y={y(b.medium + b.high)}
                      width={barW}
                      height={hh(b.high)}
                      rx={3}
                      className="bar chart-hit"
                      style={{ ...delay, fill: "rgb(var(--chart-high))" }}
                      onMouseEnter={() => setHover(i)}
                      onClick={(e) => (e.stopPropagation(), pick(b, "High"))}
                    />
                  )}
                  <text x={cx} y={H - 9} textAnchor="middle" fontSize={10} style={{ fill: selected ? "rgb(var(--c-slate-900))" : "rgb(var(--c-slate-500))", pointerEvents: "none" }} fontWeight={selected ? 700 : 400}>
                    {b.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
