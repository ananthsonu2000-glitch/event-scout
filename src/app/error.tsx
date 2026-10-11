"use client";

import { RefreshCw } from "lucide-react";
import { ErrorState } from "@/components/EmptyState";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <ErrorState title="Something went wrong loading this page" detail={error.message}>
        <p>Check that the database is reachable, then try again.</p>
        <button onClick={reset} className="btn-secondary mt-3">
          <RefreshCw size={14} aria-hidden /> Try again
        </button>
      </ErrorState>
    </div>
  );
}
