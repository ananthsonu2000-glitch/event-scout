import Link from "next/link";

interface Props {
  values: Record<string, string>;
  options: { cities: string[]; categories: string[]; sources: string[] };
}

function Select({ name, label, options, value }: { name: string; label: string; options: string[]; value?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Plain GET form: filters live in the URL, no client JS required. */
export function Filters({ values, options }: Props) {
  const view = values.view ?? "all";
  return (
    <form action="/" method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
      <input type="hidden" name="view" value={view} />
      <div className="lg:col-span-2">
        <label className="label" htmlFor="q">
          Search
        </label>
        <input id="q" name="q" defaultValue={values.q ?? ""} placeholder="Title, organizer, reason…" className="input" />
      </div>
      <Select name="city" label="City" options={options.cities} value={values.city} />
      <Select name="category" label="Category" options={options.categories} value={values.category} />
      <Select name="source" label="Source" options={options.sources} value={values.source} />
      <div className="flex items-end gap-2 lg:col-span-1">
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input type="checkbox" name="past" value="1" defaultChecked={values.past === "1"} /> Past
        </label>
      </div>
      <div>
        <label className="label" htmlFor="from">
          From
        </label>
        <input id="from" type="date" name="from" defaultValue={values.from ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="to">
          To
        </label>
        <input id="to" type="date" name="to" defaultValue={values.to ?? ""} className="input" />
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button className="btn">Apply filters</button>
        <Link href={`/?view=${view}`} className="btn-secondary">
          Reset
        </Link>
      </div>
    </form>
  );
}
