/** What the cart page needs to know about a product. Checkout only uses id/name/price/salePrice, so the rest is optional. */
export type CartProduct = { id: string; name: string; price: number; salePrice?: number; slug?: string; image?: string; category?: string; stock?: number; preorder?: boolean; preorderStart?: string; preorderEnd?: string };
