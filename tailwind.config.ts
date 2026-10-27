import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { sky: { DEFAULT: "#8ECCFF", hover: "#6CB8F5", pale: "#EAF5FF", border: "#D8EAFE" }, page: "#F4FAFF", ink: "#2f4156", mute: "#64748B" },
    boxShadow: { soft: "0 6px 24px rgba(142,204,255,.25)", lift: "0 14px 36px rgba(108,184,245,.4)" }, borderRadius: { xl2: "1.5rem" } } },
} satisfies Config;
