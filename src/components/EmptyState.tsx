import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center animate-fade-up">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Inbox size={20} aria-hidden />
      </span>
      <p className="font-semibold text-slate-900">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && (
        <Link href={action.href} className="btn-secondary mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ title, detail, children }: { title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="card border-l-4 border-l-red-500 p-6 animate-fade-up" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
          {detail && <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{detail}</pre>}
        </div>
      </div>
    </div>
  );
}
