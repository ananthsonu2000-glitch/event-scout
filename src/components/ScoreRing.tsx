/** Circular relevance score (0-100). Colour follows the score band. */
export function ScoreRing({ score, size = 44 }: { score: number | null; size?: number }) {
  if (score == null) {
    return (
      <div className="flex items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400" style={{ width: size, height: size }} title="Not ranked yet">
        n/a
      </div>
    );
  }
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "var(--chart-high)" : score >= 45 ? "var(--chart-medium)" : "var(--chart-low)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Relevance ${score}/100`} aria-label={`Relevance score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "rgb(var(--c-slate-200))" }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: `rgb(${color})` }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums text-slate-800">{score}</span>
    </div>
  );
}
