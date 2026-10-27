export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"] as const;
export const FULFILLMENT_STATUSES = ["UNFULFILLED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];
const PAY: Record<PaymentStatus, PaymentStatus[]> = { PENDING: ["PAID", "FAILED", "EXPIRED"], PAID: ["REFUNDED"], FAILED: [], EXPIRED: ["PAID"], REFUNDED: [] };
const FUL: Record<FulfillmentStatus, FulfillmentStatus[]> = { UNFULFILLED: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [] };
export const canPay = (a: PaymentStatus, b: PaymentStatus) => PAY[a].includes(b);
/** Fulfillment can only advance on PAID orders (cancel is always allowed before shipping). */
export const canFulfil = (a: FulfillmentStatus, b: FulfillmentStatus, pay: PaymentStatus) => FUL[a].includes(b) && (b === "CANCELLED" || pay === "PAID");
/** What the customer must pay right now: the deposit for a pre-order, otherwise the whole total. */
export const payNowCents = (o: { totalCents: number; preorder?: { depositCents: number } }) => (o.preorder ? o.preorder.depositCents : o.totalCents);
