import type { Product } from '~/types';

const LOCAL_KEY = 'kiaakala-favorites';
const favoriteIds = ref<Set<string>>(new Set());
const favoritesLoaded = ref(false);
const favoritesLoading = ref(false);

function readLocalIds(): string[] {
  if (!import.meta.client) return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocalIds(ids: Set<string>) {
  if (!import.meta.client) return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
}

let inflight: Promise<Product[]> | null = null;

export function useFavorites() {
  const authStore = useAuthStore();
  const api = useApi();
  const toast = useToast();

  const count = computed(() => favoriteIds.value.size);

  function isFavorite(productId: string) {
    return favoriteIds.value.has(productId);
  }

  async function fetchFavoriteProducts(ids: string[]) {
    if (!ids.length) return [] as Product[];
    const { data } = await api.get<{ products: Product[] }>(`/products?ids=${ids.join(',')}&limit=${ids.length}`);
    return data.products;
  }

  async function fetchFavorites(force = false): Promise<Product[]> {
    if (inflight && !force) return inflight;

    if (!force && favoritesLoaded.value) {
      if (!authStore.isLoggedIn) {
        return fetchFavoriteProducts([...favoriteIds.value]);
      }
      const { data } = await api.get<Product[]>('/favorites');
      return data;
    }

    inflight = (async () => {
      favoritesLoading.value = true;
      try {
        if (!authStore.isLoggedIn) {
          const ids = readLocalIds();
          favoriteIds.value = new Set(ids);
          favoritesLoaded.value = true;
          return fetchFavoriteProducts(ids);
        }

        const { data } = await api.get<Product[]>('/favorites');
        favoriteIds.value = new Set(data.map((item) => item.id));
        favoritesLoaded.value = true;
        return data;
      } catch {
        favoriteIds.value = new Set();
        favoritesLoaded.value = true;
        return [] as Product[];
      } finally {
        favoritesLoading.value = false;
        inflight = null;
      }
    })();

    return inflight;
  }

  async function addFavorite(productId: string) {
    if (!authStore.isLoggedIn) {
      const next = new Set(favoriteIds.value);
      next.add(productId);
      favoriteIds.value = next;
      writeLocalIds(next);
      toast.success('محصول ذخیره شد');
      return true;
    }

    try {
      await api.post('/favorites', { productId });
      favoriteIds.value = new Set([...favoriteIds.value, productId]);
      toast.success('محصول ذخیره شد');
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطا در افزودن به علاقه‌مندی‌ها');
      return false;
    }
  }

  async function removeFavorite(productId: string) {
    if (!authStore.isLoggedIn) {
      const next = new Set(favoriteIds.value);
      next.delete(productId);
      favoriteIds.value = next;
      writeLocalIds(next);
      toast.success('از ذخیره‌ها حذف شد');
      return true;
    }

    try {
      await api.delete(`/favorites/${productId}`);
      const next = new Set(favoriteIds.value);
      next.delete(productId);
      favoriteIds.value = next;
      toast.success('از ذخیره‌ها حذف شد');
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطا در حذف از علاقه‌مندی‌ها');
      return false;
    }
  }

  async function toggleFavorite(productId: string) {
    if (isFavorite(productId)) {
      await removeFavorite(productId);
    } else {
      await addFavorite(productId);
    }
  }

  watch(
    () => authStore.isLoggedIn,
    async (loggedIn) => {
      if (loggedIn) {
        const localIds = readLocalIds();
        if (localIds.length) {
          try {
            await api.post('/favorites/sync', { productIds: localIds });
            localStorage.removeItem(LOCAL_KEY);
          } catch {
            // keep local until next login
          }
        }
        await fetchFavorites(true);
      } else {
        favoriteIds.value = new Set(readLocalIds());
        favoritesLoaded.value = true;
      }
    }
  );

  return {
    favoriteIds: readonly(favoriteIds),
    count,
    favoritesLoaded: readonly(favoritesLoaded),
    favoritesLoading: readonly(favoritesLoading),
    isFavorite,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
}
