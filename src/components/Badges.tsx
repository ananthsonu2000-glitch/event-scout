import type { EventRow } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: EventRow["priority"] }) {
  const style =
    priority === "High"
      ? "bg-red-100 text-red-800"
      : priority === "Medium"
        ? "bg-amber-100 text-amber-800"
        : priority === "Low"
          ? "bg-slate-100 text-slate-600"
          : "bg-slate-100 text-slate-500";
  return <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${style}`}>{priority ?? "Unranked"}</span>;
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "red" | "blue" | "amber" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-600 text-white",
    blue: "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = {
    registration_open: "Registration open",
    deadline_unknown: "Deadline unknown",
    closed: "Closed",
    past: "Past",
  };
  return <Pill tone={status === "closed" || status === "past" ? "slate" : "blue"}>{label[status] ?? status}</Pill>;
}
