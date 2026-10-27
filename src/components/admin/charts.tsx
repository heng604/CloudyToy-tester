import { useState } from "react";
/** Tiny dependency-free SVG charts in the dashboard style (smooth lines, rings, rounded bars, calendar). */
export const C = { indigo: "#5AA9F0", teal: "#7FD6C4", yellow: "#FFD66B", orange: "#FFA9B8", violet: "#B8A6F2", ink: "#2f4156", grid: "#E1EEF9" };
/** Smooth curve through points (Catmull-Rom converted to cubic Bézier). */
const curve = (pts: [number, number][]) => pts.reduce((d, p, i) => {
  if (i === 0) return `M${p[0]},${p[1]}`;
  const p0 = pts[i - 2] ?? pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] ?? p;
  return `${d} C${p1[0] + (p[0] - p0[0]) / 6},${p1[1] + (p[1] - p0[1]) / 6} ${p[0] - (p3[0] - p1[0]) / 6},${p[1] - (p3[1] - p1[1]) / 6} ${p[0]},${p[1]}`;
}, "");
export function SmoothLine({ series, labels, height = 120, width = 300, fill = false, dots = "max", ariaLabel }: { series: { values: number[]; color: string }[]; labels?: string[]; height?: number; width?: number; fill?: boolean; dots?: "max" | "all" | "none"; ariaLabel: string }) {
  const W = width, H = height, pad = 10, n = Math.max(2, series[0]?.values.length ?? 2);
  /* each line is scaled on its own so a small series (orders) is not flattened by a big one (revenue) */
  const pts = (v: number[]): [number, number][] => { const top = Math.max(1, ...v); return v.map((y, i) => [pad + (i * (W - pad * 2)) / (n - 1), H - 16 - (y / top) * (H - 16 - pad - 6)]); };
  return (<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
    {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={pad} x2={W - pad} y1={pad + g * (H - 26)} y2={pad + g * (H - 26)} stroke={C.grid} strokeDasharray="3 4" />)}
    {series.map((s, k) => { const p = pts(s.values); const d = curve(p); const mi = s.values.indexOf(Math.max(...s.values));
      return (<g key={k}>{fill && <path d={`${d} L${p[p.length - 1][0]},${H - pad} L${p[0][0]},${H - pad} Z`} fill={s.color} opacity=".12" />}
        <path d={d} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" />
        {dots === "all" && p.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2" />)}
        {dots === "max" && s.values[mi] > 0 && <circle cx={p[mi][0]} cy={p[mi][1]} r="5" fill="#fff" stroke={s.color} strokeWidth="3" />}</g>); })}
    {labels && <g fontSize="9" fill="#94A3B8" textAnchor="middle" style={{ fontSize: 9 }}>{labels.map((l, i) => (i % Math.ceil(n / 7) === 0 ? <text key={i} x={pad + (i * (W - pad * 2)) / (n - 1)} y={H - 0.5}>{l}</text> : null))}</g>}
  </svg>);
}
export function Donut({ percent, color, size = 120, label, ariaLabel }: { percent: number; color: string; size?: number; label?: string; ariaLabel: string }) {
  const r = 42, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, percent));
  return (<div className="relative mx-auto" style={{ width: size, height: size, maxWidth: "100%" }}><svg viewBox="0 0 100 100" role="img" aria-label={ariaLabel} className="h-full w-full -rotate-90"><circle cx="50" cy="50" r={r} fill="none" stroke="#E6F2FC" strokeWidth="10" />
    <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} /></svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-2xl font-extrabold leading-none">{Math.round(p)}%</p>{label && <p className="mt-1 text-[11px] text-mute">{label}</p>}</div></div></div>);
}
/** Grouped rounded bars. */
export function Bars({ groups, labels, colors, height = 130, ariaLabel }: { groups: number[][]; labels: string[]; colors: string[]; height?: number; ariaLabel: string }) {
  const max = Math.max(1, ...groups.flat()); const W = 300, H = height, bw = 9, gap = (W - 20) / groups.length;
  return (<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
    {[0, 0.5, 1].map((g) => <line key={g} x1="10" x2={W - 10} y1={8 + g * (H - 28)} y2={8 + g * (H - 28)} stroke={C.grid} />)}
    {groups.map((g, i) => <g key={i}>{g.map((v, k) => { const h = (v / max) * (H - 32); const x = 10 + i * gap + gap / 2 - (g.length * (bw + 2)) / 2 + k * (bw + 2);
      return <rect key={k} x={x} y={H - 20 - h} width={bw} height={Math.max(v ? 3 : 0, h)} rx="4" fill={colors[k]} />; })}
      <text x={10 + i * gap + gap / 2} y={H - 6} fontSize="9" fill="#94A3B8" textAnchor="middle">{labels[i]}</text></g>)}
  </svg>);
}
/** Month calendar. `marks` = YYYY-MM-DD -> number of orders that day. */
export function Calendar({ marks, locale, today, daysLabel }: { marks: Record<string, number>; locale: string; today: string; daysLabel: (n: number) => string }) {
  const [m, setM] = useState(() => { const [y, mo] = today.split("-").map(Number); return { y, mo: mo - 1 }; });
  const first = new Date(Date.UTC(m.y, m.mo, 1)), len = new Date(Date.UTC(m.y, m.mo + 1, 0)).getUTCDate(), lead = first.getUTCDay();
  const fmt = (o: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...o }).format(d);
  const wk = Array.from({ length: 7 }, (_, i) => fmt({ weekday: "narrow" }, new Date(Date.UTC(2023, 0, 1 + i))));
  const go = (d: number) => setM((s) => { const t = new Date(Date.UTC(s.y, s.mo + d, 1)); return { y: t.getUTCFullYear(), mo: t.getUTCMonth() }; });
  const cells = [...Array(lead).fill(0), ...Array.from({ length: len }, (_, i) => i + 1)];
  const key = (d: number) => `${m.y}-${String(m.mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const btn = "grid h-8 w-8 place-items-center rounded-full text-sky-hover hover:bg-sky-pale";
  return (<div><div className="mb-2 flex items-center justify-between"><button type="button" onClick={() => go(-1)} aria-label="‹" className={btn}>‹</button><p className="font-extrabold capitalize">{fmt({ month: "long", year: "numeric" }, first)}</p><button type="button" onClick={() => go(1)} aria-label="›" className={btn}>›</button></div>
    <div className="grid grid-cols-7 gap-y-1 text-center text-xs" role="grid">{wk.map((w, i) => <span key={i} className="pb-1 text-[11px] font-bold uppercase text-mute">{w}</span>)}
      {cells.map((d, i) => { if (!d) return <span key={i} />; const k = key(d), n = marks[k] ?? 0, now = k === today;
        return <span key={i} title={n ? daysLabel(n) : undefined} className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-[13px] ${now ? "bg-[#FFD66B] font-extrabold ring-2 ring-[#FFD66B]/40" : n ? "font-bold text-ink ring-2 ring-[#8ECCFF]" : "text-ink"}`}>{d}</span>; })}</div></div>);
}

/** Multi-segment ring (e.g. sales by category). `parts` are drawn clockwise from the top. */
export function Ring({ parts, size = 130, center, ariaLabel }: { parts: { value: number; color: string }[]; size?: number; center?: React.ReactNode; ariaLabel: string }) {
  const r = 42, c = 2 * Math.PI * r, total = parts.reduce((a, p) => a + p.value, 0); let off = 0;
  return (<div className="relative mx-auto" style={{ width: size, height: size, maxWidth: "100%" }}><svg viewBox="0 0 100 100" role="img" aria-label={ariaLabel} className="h-full w-full -rotate-90"><circle cx="50" cy="50" r={r} fill="none" stroke="#E6F2FC" strokeWidth="12" />
    {total > 0 && parts.map((p, i) => { const len = (p.value / total) * c, el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="12" strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-off} />; off += len; return el; })}</svg>
    {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}</div>);
}
