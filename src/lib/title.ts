import { useEffect } from "react";
/** Same title template as before: "Page | Cloudy-Toy". Admin pages ask search engines not to index them. */
export function useTitle(title?: string, noindex = false) {
  useEffect(() => {
    document.title = title ? `${title} | Cloudy-Toy` : "Cloudy-Toy";
    let m = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (noindex) { if (!m) { m = document.createElement("meta"); m.name = "robots"; document.head.appendChild(m); } m.content = "noindex"; } else m?.remove();
  }, [title, noindex]);
}
