import type { FormEvent } from "react";
import type { SetURLSearchParams } from "react-router-dom";
/** Replacement for a plain <form> (GET): puts the fields into the URL query, like the old server-rendered filters. */
export const getSubmit = (set: SetURLSearchParams) => (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const p = new URLSearchParams(); new FormData(e.currentTarget).forEach((v, k) => { if (typeof v === "string") p.append(k, v); }); set(p); };
