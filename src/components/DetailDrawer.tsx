"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Side panel on desktop, bottom sheet with a dimmed backdrop on small screens.
 * Esc and backdrop click both close it (navigate to closeHref).
 */
export function DetailDrawer({ closeHref, children }: { closeHref: string; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <>
      <Link href={closeHref} scroll={false} aria-label="Close details" className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden" />
      <aside
        role="dialog"
        aria-label="Event details"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-xl bg-white shadow-lift animate-sheet-up lg:sticky lg:top-[72px] lg:z-auto lg:max-h-[calc(100vh-92px)] lg:animate-slide-in lg:rounded-lg"
      >
        {children}
      </aside>
    </>
  );
}
