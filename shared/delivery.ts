export type Area = "PHNOM_PENH" | "PROVINCE";
export type Method = "COD" | "QR_IMAGE" | "BAKONG";
export const shippingFor = (a: Area, s: { shipPhnomPenhCents: number; shipProvinceCents: number }) => (a === "PHNOM_PENH" ? s.shipPhnomPenhCents : s.shipProvinceCents);
/** Pay-with-delivery (cash) is Phnom Penh only. Enforced on the server, not just in the form. */
export const methodAllowed = (m: Method, a: Area) => m === "QR_IMAGE" || m === "BAKONG" || (m === "COD" && a === "PHNOM_PENH");
/** "Phnom Penh" or "Province: Siem Reap" */
export const areaLabel = (o: { area: Area; province?: string }) => (o.area === "PHNOM_PENH" ? "Phnom Penh" : o.province ? `Province: ${o.province}` : "Province");
export const methodLabel = (m: Method) => (m === "COD" ? "Pay with delivery" : m === "BAKONG" ? "Bakong KHQR" : "QR image payment");
