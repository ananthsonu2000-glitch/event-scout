import { daysBetween } from "./dates";

export interface SourceStyle {
  label: string;
  className: string;
}

/** Colour-coded source badges. Matching is by source name, falling back to a neutral "organizer site" style. */
export function sourceStyle(name: string, type?: string): SourceStyle {
  const n = name.toLowerCase();
  if (n.includes("linkedin") || (type ?? "").includes("linkedin")) return { label: "LinkedIn Signal", className: "bg-sky-50 text-sky-800 ring-sky-200" };
  if (n.includes("google alert")) return { label: "Google Alerts", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
  if (n.includes("luma")) return { label: "Luma", className: "bg-violet-50 text-violet-800 ring-violet-200" };
  if (n.includes("meetup")) return { label: "Meetup", className: "bg-rose-50 text-rose-800 ring-rose-200" };
  if (n.includes("eventbrite")) return { label: "Eventbrite", className: "bg-orange-50 text-orange-800 ring-orange-200" };
  if (n.includes("10times")) return { label: "10Times", className: "bg-teal-50 text-teal-800 ring-teal-200" };
  if (n.includes("manual")) return { label: "Manual", className: "bg-indigo-50 text-indigo-800 ring-indigo-200" };
  if (n.includes("gmail")) return { label: "Forwarded email", className: "bg-cyan-50 text-cyan-800 ring-cyan-200" };
  return { label: name, className: "bg-slate-100 text-slate-700 ring-slate-200" };
}

export function relDays(iso: string | null, today: string): string | null {
  if (!iso) return null;
  const d = daysBetween(today, iso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export interface DeadlineInfo {
  label: string;
  tone: "urgent" | "normal" | "muted" | "closed";
}

export function deadlineInfo(deadline: string | null, urgent: boolean, status: string, today: string): DeadlineInfo {
  if (status === "closed") return { label: "Registration closed", tone: "closed" };
  if (!deadline) return { label: "Deadline unknown", tone: "muted" };
  const d = daysBetween(today, deadline);
  if (urgent) return { label: d <= 0 ? "Closes today" : d === 1 ? "Deadline tomorrow" : `Deadline in ${d} days`, tone: "urgent" };
  return { label: `Register by ${new Date(`${deadline}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}`, tone: "normal" };
}

export function timeAgo(epochMs: number | null): string {
  if (!epochMs) return "never";
  const mins = Math.max(0, Math.round((Date.now() - epochMs) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
