export type StoredOrder = {
  orderNumber: string; createdAt: string; area: "PHNOM_PENH" | "PROVINCE"; province?: string; method: "COD" | "QR_IMAGE" | "BAKONG";
  customer: { name: string; email: string; phone: string; address: string; notes?: string; facebook?: string; telegram?: string };
  items: { productId: string; sku: string; name: string; qty: number; unitCents: number; lineCents: number; opens?: string; closes?: string }[];
  subtotalCents: number; discountCents: number; shippingCents: number; totalCents: number; currency: "USD";
  discountCode?: string; autoDiscounts?: { id: string; name: string; cents: number }[]; preorder?: { percent: number; depositCents: number; balanceCents: number; dispatch: string; full?: boolean; opens?: string; closes?: string /* old orders only: one window for the whole order */ }; accountEmail?: string; paymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED"; paidAt?: string; bakongMd5s?: string[]; bakongQrExpiresAt?: number; stockReleased?: boolean; bakongHash?: string; paidManuallyBy?: string; paymentReference: string;
  claimedPaidAt?: string; paymentProof?: string; proofAt?: string; claimEmail?: { status: "SENT" | "SKIPPED" | "FAILED"; detail?: string }; customerEmail?: { status: "SENT" | "SKIPPED" | "FAILED"; detail?: string; kind?: "placed" | "paid" };
  email: { status: "NONE" | "SENT" | "SKIPPED" | "FAILED"; detail?: string; attempts: number };
};
export type Settings = { shipPhnomPenhCents: number; shipProvinceCents: number; telegramUrl: string; facebookUrl: string; instagramUrl: string; logoUrl: string; banners: string[]; categories: string[]; qrUrl: string; payBakong: "on" | "paused" | "soon"; payQr: "on" | "paused" | "soon"; payCod: "on" | "paused" | "soon" };
export const DEFAULT_SETTINGS: Settings = { shipPhnomPenhCents: 150, shipProvinceCents: 200, telegramUrl: "", facebookUrl: "", instagramUrl: "", logoUrl: "/img/logo.png", banners: [], categories: [], qrUrl: "/img/qr-pay.png", payBakong: "on", payQr: "on", payCod: "on" };
