// wrangler.jsonc aliases "iconv-lite" to this file. The real iconv-lite (used by express's body-parser/raw-body) crashes while
// loading inside the Workers bundle ("require_streams(...) is not a function", error 10021). Request bodies here are UTF-8 only,
// so the platform's TextDecoder is all that is needed.
const norm = (e: string) => String(e || "utf-8").toLowerCase().replace(/[^a-z0-9]/g, "");
const OK = new Set(["utf8", "utf16le", "ucs2", "latin1", "binary", "ascii", "usascii", "iso88591", "windows1252"]);
const label = (e: string) => { const n = norm(e); return n === "utf8" ? "utf-8" : n === "utf16le" || n === "ucs2" ? "utf-16le" : n === "ascii" || n === "usascii" || n === "latin1" || n === "binary" || n === "iso88591" ? "windows-1252" : n; };
const iconv = {
  encodingExists: (enc: string) => OK.has(norm(enc)),
  decode: (buf: Uint8Array, enc?: string) => new TextDecoder(label(enc || "utf-8")).decode(buf),
  encode: (str: string) => Buffer.from(String(str), "utf8"),
  getDecoder: (enc?: string) => {
    const d = new TextDecoder(label(enc || "utf-8"));
    return { write: (b: Uint8Array) => d.decode(b, { stream: true }), end: () => d.decode() };
  },
  getEncoder: () => ({ write: (s: string) => Buffer.from(s, "utf8"), end: () => undefined }),
};
export default iconv;
export const { encodingExists, decode, encode, getDecoder, getEncoder } = iconv;
