/** Demo adapter: NEVER verifies a payment. Used when Bakong credentials are absent. */
export const DEMO_MODE = !process.env.BAKONG_API_KEY || !process.env.BAKONG_MERCHANT_ID;
export async function verifyWithProvider(): Promise<null> { return null; } // null = "cannot verify", never "paid"
