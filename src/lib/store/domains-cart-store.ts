import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  name: string;
  fqdn: string;
  status: 'available' | 'registered';
  price: string; // String-serialized BigInt (wei) to prevent JSON serialization/deserialization limits
}

interface DomainsCartState {
  cartItems: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (fqdn: string) => void;
  clearCart: () => void;
}

export const useDomainsCartStore = create<DomainsCartState>()(
  persist(
    (set) => ({
      cartItems: [],
      addItem: (item) =>
        set((state) => {
          const exists = state.cartItems.some((i) => i.fqdn.toLowerCase() === item.fqdn.toLowerCase());
          if (exists) return state;
          return { cartItems: [...state.cartItems, item] };
        }),
      removeItem: (fqdn) =>
        set((state) => ({
          cartItems: state.cartItems.filter((i) => i.fqdn.toLowerCase() !== fqdn.toLowerCase()),
        })),
      clearCart: () => set({ cartItems: [] }),
    }),
    {
      name: 'rns-domains-cart',
    }
  )
);
