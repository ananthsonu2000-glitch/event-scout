"use client";

import { X } from "lucide-react";
import { useState } from "react";

/** Chip-style list editor. Submits as a single comma-separated form field, matching the server action. */
export function TagInput({ name, label, defaultValue, placeholder, hint }: { name: string; label: string; defaultValue: string[]; placeholder?: string; hint?: string }) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setTags((t) => [...t, ...parts.filter((p) => !t.some((x) => x.toLowerCase() === p.toLowerCase()))]);
    setDraft("");
  };

  return (
    <div>
      <label className="label" htmlFor={`${name}-input`}>
        {label}
      </label>
      <input type="hidden" name={name} value={tags.join(", ")} />
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white p-1.5 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-1 pl-2 pr-1 text-sm text-slate-800">
            {t}
            <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-label={`Remove ${t}`}>
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          id={`${name}-input`}
          value={draft}
          onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && tags.length) setTags(tags.slice(0, -1));
          }}
          onBlur={() => commit(draft)}
          placeholder={tags.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
