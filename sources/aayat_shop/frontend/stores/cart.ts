import { defineStore } from 'pinia';
import type { Cart, CartItem } from '~/types';

export const useCartStore = defineStore('cart', {
  state: () => ({
    cart: null as Cart | null,
    loading: false,
    addingProductId: null as string | null,
  }),

  getters: {
    items: (state) => state.cart?.items ?? [],
    totalItems: (state) => state.cart?.totalItems ?? 0,
    totalPrice: (state) => state.cart?.totalPrice ?? 0,
    isEmpty: (state) => !state.cart?.items.length,
    getItemQuantity: (state) => (productId: string) => {
      const item = state.cart?.items.find((i) => i.productId === productId);
      return item?.quantity ?? 0;
    },
  },

  actions: {
    async fetchCart() {
      this.loading = true;
      try {
        const api = useApi();
        const { data } = await api.get<Cart>('/cart');
        this.cart = data;
      } catch {
        this.cart = { id: '', items: [], totalItems: 0, totalPrice: 0 };
      } finally {
        this.loading = false;
      }
    },

    async addItem(productId: string, quantity = 1) {
      this.addingProductId = productId;
      try {
        const api = useApi();
        const { data } = await api.post<Cart>('/cart/items', { productId, quantity });
        this.cart = data;
      } finally {
        this.addingProductId = null;
      }
    },

    async updateQuantity(productId: string, quantity: number) {
      const api = useApi();
      const { data } = await api.put<Cart>(`/cart/items/${productId}`, { quantity });
      this.cart = data;
    },

    async removeItem(productId: string) {
      const api = useApi();
      const { data } = await api.delete<Cart>(`/cart/items/${productId}`);
      this.cart = data;
    },

    async clearCart() {
      const api = useApi();
      const { data } = await api.delete<Cart>('/cart');
      this.cart = data;
    },
  },
});
