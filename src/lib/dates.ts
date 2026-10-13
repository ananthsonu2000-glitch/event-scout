const IST = "Asia/Kolkata";

/** Today's calendar date in IST as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(now);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Best-effort conversion of an arbitrary date string to YYYY-MM-DD in IST (null if unparseable).
 * Timestamps in UTC ("...Z" / "+00:00") are converted to the IST calendar day; other offsets keep their local date.
 */
export function toIsoDate(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]00:?00)$/.test(s)) return todayIST(new Date(s));
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return todayIST(new Date(t));
}

export type DatePrecision = "exact" | "month";

export function fmtDate(iso?: string | null, withYear = false, precision: DatePrecision = "exact"): string {
  if (!iso) return "Date not found";
  const d = new Date(`${iso}T00:00:00Z`);
  if (precision === "month") {
    return `${d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })} (tentative)`;
  }
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** True when the event is over. A month-level (tentative) date only counts as past once that month has ended. */
export function isPastDate(eventDate: string | null, today: string, precision: DatePrecision = "exact"): boolean {
  if (!eventDate) return false;
  return precision === "month" ? eventDate.slice(0, 7) < today.slice(0, 7) : eventDate < today;
}

/** Derived, time-dependent event fields. Deadline is only urgent when it is known and < 7 days away. */
export function deriveStatus(
  eventDate: string | null,
  deadline: string | null,
  today: string,
  precision: DatePrecision = "exact",
): { status: string; deadline_urgent: boolean } {
  const urgent = !!deadline && daysBetween(today, deadline) >= 0 && daysBetween(today, deadline) < 7;
  let status = "deadline_unknown";
  if (isPastDate(eventDate, today, precision)) status = "past";
  else if (deadline && deadline < today) status = "closed";
  else if (deadline) status = "registration_open";
  return { status, deadline_urgent: urgent };
}
