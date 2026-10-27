import { useRef, useState } from "react";
import { FALLBACK_IMG } from "@shared/products";
type Img = { src: string; alt: string };
/** Product photo viewer: big image, previous/next buttons, thumbnails, keyboard arrows and swipe. */
export default function ProductGallery({ images, name }: { images: Img[]; name: string }) {
  const list = images.length ? images : [{ src: FALLBACK_IMG, alt: name }];
  const [i, setI] = useState(0); const touchX = useRef<number | null>(null); const many = list.length > 1;
  const go = (n: number) => setI((n + list.length) % list.length);
  const btn = "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-soft backdrop-blur transition hover:bg-white hover:shadow-lift focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100";
  return (<div className="space-y-3" aria-roledescription="carousel" aria-label={`${name} photos`}>
    <div tabIndex={0} onKeyDown={(e) => { if (!many) return; if (e.key === "ArrowLeft") go(i - 1); if (e.key === "ArrowRight") go(i + 1); }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (!many || touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); touchX.current = null; }}
      className="group relative aspect-square overflow-hidden rounded-xl2 border border-sky-border bg-sky-pale shadow-soft sm:aspect-[4/3]">
      <img key={list[i].src} src={list[i].src} alt={list[i].alt || name} className="h-full w-full object-contain" />
      {many && <>
        <button type="button" aria-label="Previous photo" onClick={() => go(i - 1)} className={`${btn} left-3`}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
        <button type="button" aria-label="Next photo" onClick={() => go(i + 1)} className={`${btn} right-3`}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
        <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-bold text-white" aria-live="polite">{i + 1} / {list.length}</span></>}
    </div>
    {many && <ul className="flex gap-2 overflow-x-auto pb-1">{list.map((im, n) => <li key={im.src}><button type="button" aria-label={`Show photo ${n + 1}`} aria-current={n === i} onClick={() => setI(n)}
      className={`block h-16 w-16 overflow-hidden rounded-xl border-2 bg-sky-pale sm:h-20 sm:w-20 ${n === i ? "border-sky-hover" : "border-transparent opacity-70 hover:opacity-100"}`}><img src={im.src} alt="" className="h-full w-full object-cover" /></button></li>)}</ul>}
  </div>);
}
