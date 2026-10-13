import Link from "next/link";
import { X } from "lucide-react";
import { fmtDate } from "@/lib/dates";

/** Chips for filters set by clicking the charts (priority, period, city), each removable on its own. */
export function ActiveFilters({ sp, hrefWithout }: { sp: Record<string, string>; hrefWithout: (keys: string[]) => string }) {
  const chips: { label: string; remove: string[] }[] = [];
  if (sp.priority) chips.push({ label: `${sp.priority} priority`, remove: ["priority"] });
  if (sp.from || sp.to) {
    const label = sp.from && sp.to ? (sp.from === sp.to ? fmtDate(sp.from) : `${fmtDate(sp.from)} to ${fmtDate(sp.to)}`) : sp.from ? `From ${fmtDate(sp.from)}` : `Until ${fmtDate(sp.to)}`;
    chips.push({ label, remove: ["from", "to"] });
  }
  if (sp.city) chips.push({ label: sp.city, remove: ["city"] });
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <span className="text-xs font-medium text-slate-500">Showing:</span>
      {chips.map((c) => (
        <Link key={c.label} href={hrefWithout(c.remove)} scroll={false} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-2 text-xs font-medium text-slate-800 transition hover:bg-slate-200" aria-label={`Remove filter ${c.label}`}>
          {c.label}
          <X size={13} aria-hidden />
        </Link>
      ))}
      <Link href={hrefWithout(chips.flatMap((c) => c.remove))} scroll={false} className="text-xs text-slate-500 hover:text-slate-900 hover:underline">
        Clear
      </Link>
    </div>
  );
}
