import { useRef, useState, type DragEvent } from "react";
const TYPES = ["image/png", "image/jpeg", "image/webp"];
const hand = '"Caveat","Segoe Print","Bradley Hand","Comic Sans MS",cursive';
/** Customer "upload your payment screenshot" box: soft cloud card, round sky button, drag & drop (or paste), live preview with Change / Remove. */
export default function ProofPicker({ file, preview, onPick, disabled }: { file: File | null; preview: string; onPick: (f: File | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null); const [over, setOver] = useState(false); const [bad, setBad] = useState("");
  const take = (f: File | null | undefined) => {
    if (!f) return; if (!TYPES.includes(f.type)) { setBad("Please choose a picture (JPG, PNG or WebP)."); return; }
    setBad(""); onPick(f);
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files[0]); };
  const clear = () => { if (ref.current) ref.current.value = ""; setBad(""); onPick(null); };
  const kb = file ? (file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`) : "";
  return (<div onPaste={(e) => { if (!disabled) take(Array.from(e.clipboardData.files)[0]); }}>
    <p className="mb-2 text-left text-2xl leading-none text-ink" style={{ fontFamily: hand, fontWeight: 700 }}>1 · Show us your payment ☁️</p>
    <input ref={ref} type="file" accept={TYPES.join(",")} onChange={(e) => take(e.target.files?.[0])} className="sr-only" tabIndex={-1} aria-label="Payment screenshot" disabled={disabled} />
    {!file ? (
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed px-4 py-6 text-center transition-colors ${over ? "border-sky-hover bg-sky" : "border-sky bg-gradient-to-br from-sky-pale to-white"}`}>
        <svg className="pointer-events-none absolute -left-3 top-2 opacity-70" width="70" viewBox="0 0 120 60" aria-hidden="true"><path d="M30 55a20 20 0 0 1-2-40 26 26 0 0 1 49-6 22 22 0 0 1 21 14 17 17 0 0 1-4 32z" fill="#fff" /></svg>
        <svg className="pointer-events-none absolute -right-2 bottom-2 opacity-70" width="54" viewBox="0 0 120 60" aria-hidden="true"><path d="M30 55a20 20 0 0 1-2-40 26 26 0 0 1 49-6 22 22 0 0 1 21 14 17 17 0 0 1-4 32z" fill="#fff" /></svg>
        <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-white shadow-soft" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#6CB8F5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.7-8.95 6 6 0 0 1 11.4 1.2A3.8 3.8 0 0 1 17.5 18" /><path d="M12 21v-8M9 15.5l3-3 3 3" /></svg></span>
        <p className="relative mt-2 text-sm text-mute">Drag your screenshot here, paste it, or</p>
        <button type="button" disabled={disabled} onClick={() => ref.current?.click()} className="relative mt-2 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky px-7 text-base font-extrabold text-ink shadow-soft transition hover:-translate-y-0.5 hover:bg-sky-hover hover:shadow-lift disabled:opacity-60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Choose screenshot</button>
        <p className="relative mt-2 text-xs text-mute">JPG, PNG or WebP · from your bank app or gallery</p>
      </div>
    ) : (
      <div className="flex items-center gap-3 rounded-3xl border-2 border-sky bg-gradient-to-br from-sky-pale to-white p-3 text-left">
        <img src={preview} alt="Your payment screenshot" className="h-24 w-20 shrink-0 rounded-2xl border-4 border-white object-cover shadow-soft" />
        <div className="min-w-0 flex-1"><p className="text-lg leading-none text-ink" style={{ fontFamily: hand, fontWeight: 700 }}>Looks good! 💙</p>
          <p className="mt-1 truncate text-sm font-bold" title={file.name}>{file.name}</p><p className="text-xs text-mute">{kb}</p>
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={() => ref.current?.click()} className="min-h-9 rounded-full bg-sky px-4 text-sm font-bold hover:bg-sky-hover disabled:opacity-60">Change</button>
            <button type="button" disabled={disabled} onClick={clear} className="min-h-9 rounded-full border border-sky-border bg-white px-4 text-sm font-bold hover:bg-sky-pale disabled:opacity-60">Remove</button></div></div>
      </div>)}
    {bad && <p role="alert" className="mt-2 text-sm text-red-700">{bad}</p>}
  </div>);
}
