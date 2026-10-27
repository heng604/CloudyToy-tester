// What an anonymous visitor may see about an order. The payment page only needs the items, totals, status and delivery area:
// customer name/phone/address/email, payment screenshot path, bank hashes and internal e-mail logs are removed, so a guessed order number reveals no personal data.
import type { StoredOrder } from "../../shared/types";
export function publicOrder(o: StoredOrder): StoredOrder {
  const { customer, accountEmail, paymentProof, proofAt, bakongMd5s, bakongQrExpiresAt, bakongHash, paidManuallyBy, claimEmail, customerEmail, email, ...rest } = o;
  void customer; void accountEmail; void paymentProof; void proofAt; void bakongMd5s; void bakongQrExpiresAt; void bakongHash; void paidManuallyBy; void claimEmail; void customerEmail;
  return { ...rest, customer: { name: "", email: "", phone: "", address: "" }, email: { status: email.status, attempts: 0 } } as StoredOrder;
}
