import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
/** Calls onChange (debounced) whenever the given tables change (Supabase Realtime). Optional polling is only used in admin. */
export default function RealtimeRefresh({ tables, onChange, indicator = false, pollMs = 0 }: { tables: string[]; onChange: () => void; indicator?: boolean; pollMs?: number }) {
  const [live, setLive] = useState(false); const key = tables.join(","); const cb = useRef(onChange); cb.current = onChange;
  useEffect(() => {
    if (!supabase) return; const sb = supabase; let t: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => cb.current(), 250); };
    let ch = sb.channel(`live-${key}-${Math.random().toString(36).slice(2, 7)}`);
    for (const table of key.split(",")) ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    ch.subscribe((s) => setLive(s === "SUBSCRIBED"));
    const poll = pollMs > 0 ? setInterval(() => { if (!document.hidden) cb.current(); }, pollMs) : undefined;
    return () => { clearTimeout(t); if (poll) clearInterval(poll); sb.removeChannel(ch); };
  }, [key, pollMs]);
  if (!indicator) return null;
  return <span className="inline-flex items-center gap-1 text-xs text-mute" role="status"><span className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-amber-400"}`} />{live ? "Live" : "Connecting…"}</span>;
}
