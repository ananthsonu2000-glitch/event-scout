import Link from "next/link";

const LINKS = [
  { href: "/", label: "Events" },
  { href: "/add", label: "Add event" },
  { href: "/preferences", label: "Preferences" },
  { href: "/sources", label: "Sources" },
  { href: "/health", label: "Source health" },
];

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Industry Event Scout
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-slate-200">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
