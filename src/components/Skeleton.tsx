/** Shown instantly while data loads, so clicks feel immediate. */
export default function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-9 w-48 rounded-full bg-sky-pale" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl2 border border-sky-border bg-white">
            <div className="aspect-[4/3] bg-sky-pale" />
            <div className="space-y-3 p-4"><div className="h-4 w-3/4 rounded-full bg-sky-pale" /><div className="h-4 w-1/3 rounded-full bg-sky-pale" /><div className="h-11 rounded-full bg-sky-pale" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
