import { createContext, useContext } from "react";

/**
 * Cart line.
 *
 * The display fields are a snapshot taken when the item was added, so the cart
 * renders instantly and survives a product being unpublished. `unitPrice` here
 * is display only: the real price is recomputed from the catalogue by
 * `place_order()` when the order is placed, so a stale snapshot can never change
 * what the buyer is charged.
 */
export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string | null;
  /** Used only to preview Elegancia's free-delivery promotion in the cart/checkout. */
  setType?: string | null;
  unitPrice: number;
  imageUrl: string | null;
  quantity: number;
};

export type CartValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  /** Cart is per-browser; a shopper who clears storage loses only the list. */
  ready: boolean;
};

export const CartContext = createContext<CartValue | null>(null);

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
