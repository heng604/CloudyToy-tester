import { useState } from "react";
import { useCart } from "@/components/CartProvider";
export default function AddButton({ id, disabled }: { id: string; disabled: boolean }) {
  const { add } = useCart(); const [q, setQ] = useState(1); const [done, setDone] = useState(false);
  return (<div className="flex items-center gap-3"><label className="sr-only" htmlFor="qty">Quantity</label>
    <input id="qty" type="number" min={1} max={20} value={q} onChange={(e) => setQ(Math.max(1, Number(e.target.value) || 1))} className="w-20 rounded-full border border-sky-border px-3 py-2" />
    <button disabled={disabled} onClick={() => { add(id, q); setDone(true); }} className="min-h-11 rounded-full bg-sky px-6 font-bold hover:bg-sky-hover disabled:opacity-50">Add to cart</button>
    {done && <span role="status" className="text-sm text-mute">Added</span>}</div>);
}
