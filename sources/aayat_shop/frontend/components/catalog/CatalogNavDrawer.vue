<script setup lang="ts">
import type { Category } from '~/types';
import { SITE_NAME } from '~/constants/site';
import { navCategoryLabel } from '~/constants/categoryNav';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const api = useApi();

const { data: categories, refresh } = await useAsyncData('catalog-nav-categories', async () => {
  try {
    const { data } = await api.get<Category[]>('/categories?lite=1');
    return data ?? [];
  } catch {
    return [];
  }
});

const { roots, childrenOf, defaultRootSlug } = useCategoryNavTree(computed(() => categories.value));

const activeRootSlug = ref<string | null>(null);
const expandedSlug = ref<string | null>(null);
const closeBtnRef = ref<HTMLButtonElement | null>(null);

const activeRoot = computed(() => roots.value.find((root) => root.slug === activeRootSlug.value) ?? null);

const subcategories = computed(() => {
  if (!activeRootSlug.value) return [];
  return childrenOf(activeRootSlug.value);
});

const shortcuts = [
  { to: '/search?sort=newest', label: 'جدیدترین', icon: 'lucide:sparkles' },
  { to: '/search?discounted=1', label: 'پیشنهاد ویژه', icon: 'lucide:percent' },
  { to: '/profile/favorites', label: 'علاقه‌مندی‌ها', icon: 'lucide:bookmark' },
];

const sitePages = [
  { to: '/', label: 'صفحه اصلی' },
  { to: '/categories', label: 'کالکشن‌ها' },
  { to: '/cart', label: 'سبد خرید' },
  { to: '/profile/orders', label: 'پیگیری سفارش' },
  { to: '/pages/about', label: 'درباره ما' },
  { to: '/contact', label: 'تماس با ما' },
  { to: '/pages/terms', label: 'قوانین' },
];

function syncExpanded() {
  expandedSlug.value = null;
}

watch(
  () => props.open,
  async (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (!isOpen) return;
    void refresh();
    activeRootSlug.value = defaultRootSlug();
    await nextTick();
    syncExpanded();
    closeBtnRef.value?.focus();
  },
);

watch(roots, (list) => {
  if (!activeRootSlug.value && list.length) {
    activeRootSlug.value = list[0].slug;
  }
});

watch(activeRootSlug, () => {
  if (props.open) syncExpanded();
});

function pickRoot(slug: string) {
  activeRootSlug.value = slug;
}

function toggleExpand(slug: string) {
  expandedSlug.value = expandedSlug.value === slug ? null : slug;
}

function go(path: string) {
  emit('close');
  navigateTo(path);
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    e.preventDefault();
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="nav-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] bg-neutral-950/40"
        aria-hidden="true"
        @click="onBackdropClick"
      />
    </Transition>

    <Transition name="nav-slide">
      <aside
        v-if="open"
        class="nav-panel fixed inset-y-0 z-[81] flex w-full max-w-[28rem] flex-col overflow-hidden bg-white md:max-w-[32rem]"
        role="dialog"
        aria-modal="true"
        aria-label="منوی دسته‌بندی"
      >
        <header class="shrink-0 border-b border-neutral-100 px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-medium tracking-[0.22em] text-primary-700/70">{{ SITE_NAME }}</p>
              <h2 class="mt-1 text-xl font-semibold tracking-tight text-neutral-950">منوی فروشگاه</h2>
            </div>
            <button
              ref="closeBtnRef"
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="بستن منو"
              @click="emit('close')"
            >
              <AppIcon name="lucide:x" size="md" />
            </button>
          </div>
          <div class="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              v-for="item in shortcuts"
              :key="item.to"
              type="button"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              @click="go(item.to)"
            >
              <AppIcon :name="item.icon" size="xs" />
              {{ item.label }}
            </button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 overflow-hidden">
          <nav
            class="split-rail flex w-[6.75rem] shrink-0 flex-col gap-1 overflow-y-auto border-l border-neutral-100 bg-neutral-50/90 py-3"
            aria-label="دسته‌های اصلی"
          >
            <button
              v-for="root in roots"
              :key="root.id"
              type="button"
              :class="[
                'relative px-2 py-3 text-center text-[11px] font-medium leading-4 transition-colors',
                activeRootSlug === root.slug
                  ? 'bg-white text-primary-900 shadow-[inset_3px_0_0_#6f5644]'
                  : 'text-neutral-500 hover:bg-white/70 hover:text-neutral-800',
              ]"
              :aria-current="activeRootSlug === root.slug ? 'true' : undefined"
              @click="pickRoot(root.slug)"
            >
              {{ navCategoryLabel(root) }}
            </button>
            <button
              type="button"
              class="px-2 py-3 text-center text-[11px] font-medium leading-4 text-amber-800/90 transition-colors hover:bg-white/70"
              @click="go('/search?discounted=1')"
            >
              پیشنهاد ویژه
            </button>
            <div class="mx-2 my-1 border-t border-neutral-200/90" aria-hidden="true" />
            <button
              v-for="page in sitePages"
              :key="page.to"
              type="button"
              class="px-2 py-3 text-center text-[11px] font-medium leading-4 text-neutral-500 transition-colors hover:bg-white/70 hover:text-neutral-800"
              @click="go(page.to)"
            >
              {{ page.label }}
            </button>
          </nav>

          <div class="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4">
            <button
              v-if="activeRoot"
              type="button"
              class="mb-4 flex w-full items-center justify-between gap-2 border-b border-neutral-100 pb-3 text-start"
              @click="go(`/categories/${activeRoot.slug}`)"
            >
              <span class="text-[15px] font-semibold text-neutral-950">
                همه {{ navCategoryLabel(activeRoot) }}
              </span>
              <AppIcon name="lucide:arrow-left" size="sm" class="text-neutral-400" />
            </button>

            <ul v-if="subcategories.length" class="space-y-1">
              <li
                v-for="(sub, index) in subcategories"
                :key="sub.id"
                class="nav-row"
                :style="{ '--enter-delay': `${Math.min(index, 10) * 28}ms` }"
              >
                <div class="flex items-stretch gap-1 rounded-xl hover:bg-neutral-50">
                  <button
                    type="button"
                    class="min-w-0 flex-1 px-3 py-3 text-start text-[14px] font-medium text-neutral-900"
                    @click="go(`/categories/${sub.slug}`)"
                  >
                    {{ navCategoryLabel(sub) }}
                  </button>
                  <button
                    v-if="childrenOf(sub.slug).length"
                    type="button"
                    class="inline-flex w-10 items-center justify-center text-neutral-400"
                    :aria-expanded="expandedSlug === sub.slug"
                    @click="toggleExpand(sub.slug)"
                  >
                    <AppIcon
                      :name="expandedSlug === sub.slug ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                      size="sm"
                    />
                  </button>
                </div>
                <ul
                  v-if="childrenOf(sub.slug).length && expandedSlug === sub.slug"
                  class="mb-2 mr-2 space-y-0.5 border-r border-primary-200/70 pr-3"
                >
                  <li v-for="child in childrenOf(sub.slug)" :key="child.id">
                    <button
                      type="button"
                      class="w-full rounded-lg px-2 py-2 text-start text-[12px] text-neutral-600 hover:bg-white hover:text-neutral-950"
                      @click="go(`/categories/${child.slug}`)"
                    >
                      {{ navCategoryLabel(child) }}
                    </button>
                  </li>
                </ul>
              </li>
            </ul>
            <p v-else class="py-8 text-center text-sm text-neutral-500">
              زیردسته‌ای برای این بخش ثبت نشده است.
            </p>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nav-panel {
  right: 0;
  left: auto;
  box-shadow: -18px 0 48px rgba(26, 15, 18, 0.16);
}

.nav-row {
  animation: nav-rise 0.34s ease both;
  animation-delay: var(--enter-delay, 0ms);
}

@keyframes nav-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nav-fade-enter-active,
.nav-fade-leave-active {
  transition: opacity 0.22s ease;
}
.nav-fade-enter-from,
.nav-fade-leave-to {
  opacity: 0;
}

.nav-slide-enter-active,
.nav-slide-leave-active {
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.nav-slide-enter-from,
.nav-slide-leave-to {
  transform: translate3d(100%, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  .nav-row,
  .nav-slide-enter-active,
  .nav-slide-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
