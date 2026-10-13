"use client";

import { ArrowUpDown, ChevronDown, Loader2, RotateCcw, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface Props {
  options: { cities: string[]; categories: string[]; sources: string[] };
  counts: Record<string, number>;
}

const VIEWS = [
  { key: "all", label: "All" },
  { key: "high", label: "High priority" },
  { key: "deadline", label: "Deadline soon" },
  { key: "linkedin", label: "LinkedIn signals" },
  { key: "review", label: "Needs review" },
];
const RANGES = [
  { key: "", label: "Any time" },
  { key: "week", label: "This week" },
  { key: "30", label: "Next 30 days" },
];
const SORTS = [
  { key: "relevance", label: "Relevance" },
  { key: "date", label: "Event date" },
  { key: "deadline", label: "Deadline urgency" },
  { key: "recent", label: "Recently discovered" },
];

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-ink text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {children}
      {count !== undefined && <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>{count}</span>}
    </button>
  );
}

function Select({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (v: string) => void; options: string[]; allLabel: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input appearance-none pr-8 text-[13px]">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
    </label>
  );
}

/** Live filters: every control updates the URL (the page is server-rendered from it), no Apply button needed. */
export function FilterBar({ options, counts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const urlQ = sp.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const view = sp.get("view") ?? "all";
  const range = sp.get("range") ?? "";
  const sort = sp.get("sort") ?? "relevance";

  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("event");
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  // Debounced search; keep the box in sync when the URL changes elsewhere (e.g. Reset).
  useEffect(() => setQ(urlQ), [urlQ]);
  useEffect(() => {
    if (q === urlQ) return;
    timer.current = setTimeout(() => push({ q: q.trim() || null }), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const advancedActive = !!(sp.get("from") || sp.get("to") || sp.get("past") || sp.get("low"));
  const anyFilter = !!(sp.get("q") || sp.get("city") || sp.get("category") || sp.get("source") || range || view !== "all" || advancedActive || sort !== "relevance");

  return (
    <section aria-label="Filters" className="card space-y-3 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, organizer, reason…"
            aria-label="Search events"
            className="input pl-9 pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {pending ? <Loader2 size={16} className="animate-spin" aria-label="Loading" /> : q ? <button type="button" onClick={() => { setQ(""); push({ q: null }); }} aria-label="Clear search"><X size={16} /></button> : null}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[640px]">
          <Select label="City" value={sp.get("city") ?? ""} onChange={(v) => push({ city: v || null })} options={options.cities} allLabel="All cities" />
          <Select label="Category" value={sp.get("category") ?? ""} onChange={(v) => push({ category: v || null })} options={options.categories} allLabel="All categories" />
          <Select label="Source" value={sp.get("source") ?? ""} onChange={(v) => push({ source: v || null })} options={options.sources} allLabel="All sources" />
          <label className="relative block">
            <span className="sr-only">Sort by</span>
            <ArrowUpDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <select value={sort} onChange={(e) => push({ sort: e.target.value === "relevance" ? null : e.target.value })} className="input appearance-none pl-8 pr-8 text-[13px]">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <Chip key={v.key} active={view === v.key} onClick={() => push({ view: v.key === "all" ? null : v.key })} count={counts[v.key]}>
              {v.label}
            </Chip>
          ))}
        </div>
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <Chip key={r.key} active={range === r.key} onClick={() => push({ range: r.key || null, from: null, to: null })}>
              {r.label}
            </Chip>
          ))}
          {anyFilter && (
            <button type="button" onClick={() => start(() => router.replace(pathname, { scroll: false }))} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-slate-500 hover:text-slate-900">
              <RotateCcw size={13} aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      <details className="group" open={advancedActive}>
        <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
          More filters <ChevronDown size={13} className="chevron transition" aria-hidden />
        </summary>
        <div className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-4 lg:w-[640px]">
          <div>
            <label className="label" htmlFor="from">From</label>
            <input id="from" type="date" className="input" defaultValue={sp.get("from") ?? ""} onChange={(e) => push({ from: e.target.value || null, range: null })} />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input id="to" type="date" className="input" defaultValue={sp.get("to") ?? ""} onChange={(e) => push({ to: e.target.value || null, range: null })} />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={sp.get("past") === "1"} onChange={(e) => push({ past: e.target.checked ? "1" : null })} className="h-4 w-4 rounded border-slate-300" />
            Include past events
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={sp.get("low") === "1"} onChange={(e) => push({ low: e.target.checked ? "1" : null })} className="h-4 w-4 rounded border-slate-300" />
            Include low priority
          </label>
        </div>
      </details>
    </section>
  );
}
