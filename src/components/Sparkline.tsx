/** Tiny trend line for KPI cards. The line draws in on load (CSS only). Colour comes from a --chart-* variable. */
export function Sparkline({ values, color = "var(--chart-accent)", w = 88, h = 30, label }: { values: number[]; color?: string; w?: number; h?: number; label?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 3 - (v / max) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label ?? "Trend"} className="shrink-0 overflow-visible">
      <path d={area} style={{ fill: `rgb(${color} / 0.12)` }} />
      <path d={line} pathLength={1} className="spark-line" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: `rgb(${color})` }} />
      <circle cx={lx} cy={ly} r={2.2} style={{ fill: `rgb(${color})` }} />
    </svg>
  );
}

/** Small progress ring (e.g. healthy sources out of all sources). */
export function MiniRing({ fraction, color = "var(--chart-accent)", size = 44, children }: { fraction: number; color?: string; size?: number; children?: React.ReactNode }) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3.5" style={{ stroke: "rgb(var(--c-slate-200))" }} />
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${f * 100} 100`}
          className="ring-seg"
          style={{ stroke: `rgb(${color})` }}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-700">{children}</span>}
    </div>
  );
}
