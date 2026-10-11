import { AlarmClock, CircleSlash, Clock3, Flag } from "lucide-react";
import type { EventRow, EventSourceRef } from "@/lib/types";
import { sourceStyle, type DeadlineInfo } from "@/lib/ui";

export function PriorityBadge({ priority }: { priority: EventRow["priority"] }) {
  const style =
    priority === "High"
      ? "bg-rose-600 text-white"
      : priority === "Medium"
        ? "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300"
        : priority === "Low"
          ? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
          : "bg-white text-slate-500 ring-1 ring-inset ring-slate-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style}`}>
      {priority === "High" && <Flag size={11} aria-hidden />}
      {priority ?? "Unranked"}
    </span>
  );
}

export function SourceBadge({ source }: { source: Pick<EventSourceRef, "name" | "type"> }) {
  const s = sourceStyle(source.name, source.type);
  return <span className={`inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.className}`}>{s.label}</span>;
}

export function DeadlineChip({ info }: { info: DeadlineInfo }) {
  const tones = {
    urgent: "bg-red-50 text-red-700 ring-red-200 font-semibold",
    normal: "bg-slate-50 text-slate-700 ring-slate-200",
    muted: "bg-white text-slate-400 ring-slate-200",
    closed: "bg-slate-100 text-slate-500 ring-slate-200 line-through",
  } as const;
  const Icon = info.tone === "urgent" ? AlarmClock : info.tone === "closed" ? CircleSlash : Clock3;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ring-inset ${tones[info.tone]}`}>
      <Icon size={12} aria-hidden />
      {info.label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = {
    registration_open: "Registration open",
    deadline_unknown: "Deadline unknown",
    closed: "Closed",
    past: "Past",
  };
  const tone = status === "registration_open" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}>{label[status] ?? status}</span>;
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "red" | "blue" | "amber" | "green" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}
