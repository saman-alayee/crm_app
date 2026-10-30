import { defineStore } from 'pinia';

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    totalCount: 0,
  }),

  actions: {
    async fetchCount() {
      const authStore = useAuthStore();
      if (!authStore.isLoggedIn) {
        this.totalCount = 0;
        return;
      }

      try {
        const api = useApi();
        const { data } = await api.get<{ pagination: { total: number } }>('/orders?limit=1');
        this.totalCount = data.pagination?.total ?? 0;
      } catch {
        this.totalCount = 0;
      }
    },
  },
});
