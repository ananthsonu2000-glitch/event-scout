"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

/** Submit button that shows a spinner while the server action runs. */
export function SubmitButton({ children, pendingLabel = "Working…", icon }: { children: React.ReactNode; pendingLabel?: string; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending} aria-busy={pending}>
      {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {pending ? pendingLabel : children}
    </button>
  );
}
