import { useRef, useState, type DragEvent } from "react";
/** Friendly "choose file" box for the admin: dashed drop zone, round button, live thumbnails and file names. */
export default function FilePicker({ name, multiple = false, accept = "image/png,image/jpeg,image/webp", label }: { name: string; multiple?: boolean; accept?: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ name: string; url: string; kb: number }[]>([]);
  const [over, setOver] = useState(false);
  const sync = () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
    setFiles(Array.from(ref.current?.files ?? []).map((f) => ({ name: f.name, url: URL.createObjectURL(f), kb: Math.max(1, Math.round(f.size / 1024)) })));
  };
  const drop = (e: DragEvent) => {
    e.preventDefault(); setOver(false);
    if (!ref.current || !e.dataTransfer.files.length) return;
    const dt = new DataTransfer();
    Array.from(e.dataTransfer.files).slice(0, multiple ? 10 : 1).forEach((f) => accept.split(",").includes(f.type) && dt.items.add(f));
    ref.current.files = dt.files; sync();
  };
  const clear = () => { if (ref.current) ref.current.value = ""; sync(); };
  return (<div>
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors ${over ? "border-[#6CB8F5] bg-[#E3F6F8]" : "border-[#BFE6EA] bg-[#F3FBFC]"}`}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#DDF3F7] text-[#6CB8F5]" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M12 15V4M7.5 8.5 12 4l4.5 4.5" /></svg></span>
      <p className="text-sm text-mute">{label ?? (multiple ? "Drag photos here, or" : "Drag a photo here, or")}</p>
      <button type="button" onClick={() => ref.current?.click()} className="min-h-10 rounded-full bg-sky px-6 text-sm font-bold shadow-soft hover:bg-sky-hover">{files.length ? (multiple ? "Choose different photos" : "Choose a different photo") : (multiple ? "Choose photos" : "Choose photo")}</button>
      <p className="text-xs text-mute">JPG, PNG or WebP · max 5 MB each</p>
      <input ref={ref} name={name} type="file" multiple={multiple} accept={accept} onChange={sync} className="sr-only" tabIndex={-1} />
    </div>
    {files.length > 0 && <div className="mt-3 flex flex-wrap items-start gap-3">
      {files.map((f) => <figure key={f.url} className="w-24 text-center"><img src={f.url} alt={f.name} className="h-20 w-24 rounded-xl border border-sky-border object-cover" /><figcaption className="mt-1 truncate text-[11px] text-mute" title={f.name}>{f.name}</figcaption><span className="text-[11px] text-mute">{f.kb} KB</span></figure>)}
      <button type="button" onClick={clear} className="rounded-full border border-sky-border px-3 py-1 text-xs font-bold hover:bg-sky-pale">Clear</button></div>}
  </div>);
}
