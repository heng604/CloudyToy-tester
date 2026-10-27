import { z } from "zod";
/** Only these fields are editable by a customer. Role, totals, payment status are never accepted. */
export const ProfileInput = z.object({
  display_name: z.string().trim().max(80),
  phone: z.string().trim().max(30).regex(/^[0-9+\-\s()]*$/, "Use digits, spaces, + or - only"),
});
