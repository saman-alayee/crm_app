import type { Category, Slider } from '~/types';
import {
  DEMO_CATEGORIES,
  DEMO_SLIDERS,
  getDemoCategoryBySlug,
  getDemoDiscountedProducts,
  getDemoFeaturedProducts,
  getDemoHomeFeed,
  getDemoProductBySlug,
  getDemoProductsByCategorySlug,
  getDemoRelatedProducts,
} from '~/constants/demoCatalog';

/** کاتالوگ نمایشی فقط وقتی forceDemoCatalog=true باشد. */
export function useCatalogDemo() {
  const config = useRuntimeConfig();
  const forceDemo = computed(() => Boolean(config.public.forceDemoCatalog));
  const isDemoCatalog = useState('catalog-is-demo', () => false);

  function markDemo(active: boolean) {
    isDemoCatalog.value = active;
  }

  function useDemoForApi(_hasApiRows: boolean) {
    const demo = forceDemo.value;
    markDemo(demo);
    return demo;
  }

  function categoriesForStore(fromApi: Category[] | null | undefined) {
    if (!useDemoForApi(Boolean(fromApi?.length))) return fromApi ?? [];
    return DEMO_CATEGORIES;
  }

  function slidersForStore(fromApi: Slider[] | null | undefined) {
    if (!useDemoForApi(Boolean(fromApi?.length))) return fromApi ?? [];
    return DEMO_SLIDERS;
  }

  function isDemoProductId(id: string) {
    return id.startsWith('demo-');
  }

  return {
    forceDemo,
    isDemoCatalog,
    markDemo,
    useDemoForApi,
    categoriesForStore,
    slidersForStore,
    isDemoProductId,
    demoHomeFeed: getDemoHomeFeed,
    demoFeatured: getDemoFeaturedProducts,
    demoDiscounted: getDemoDiscountedProducts,
    demoProduct: getDemoProductBySlug,
    demoCategory: getDemoCategoryBySlug,
    demoProductsByCategory: getDemoProductsByCategorySlug,
    demoRelated: getDemoRelatedProducts,
  };
}
