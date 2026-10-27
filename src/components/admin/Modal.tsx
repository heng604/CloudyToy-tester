import { useEffect, useRef, type ReactNode } from "react";
import Icon, { type IconName } from "./Icons";
/** Pop-up window (native <dialog>: Esc closes it, focus stays inside). Children get a close() they can call from Cancel / after saving. */
export default function Modal({ title, icon, onClose, wide = false, children }: { title: string; icon: IconName; onClose: () => void; wide?: boolean; children: (close: () => void) => ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const close = () => ref.current?.close();
  return (<dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) close(); }} aria-label={title}
    className={`m-auto w-full ${wide ? "max-w-5xl" : "max-w-lg"} overflow-hidden rounded-[2rem] bg-white p-0 text-ink shadow-xl backdrop:bg-slate-900/45`}>
    <div className="flex max-h-[92vh] flex-col">
      <header className="flex items-center gap-3 border-b border-sky-border bg-sky-pale/70 px-5 py-4 sm:px-7">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-sky-hover shadow-soft"><Icon name={icon} size={20} /></span>
        <h2 className="flex-1 text-lg font-extrabold">{title}</h2>
        <button type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-white hover:text-ink"><Icon name="close" size={18} /></button></header>
      <div className="overflow-y-auto">{children(close)}</div>
    </div></dialog>);
}
