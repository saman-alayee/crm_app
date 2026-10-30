<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

const props = withDefaults(defineProps<{ overlay?: boolean }>(), { overlay: false });

const injectedOverlay = inject<boolean>('headerOverlay', false);
const overlayMode = computed(() => props.overlay || injectedOverlay);

const authStore = useAuthStore();
const cartStore = useCartStore();
const { toPersianDigits } = useFormat();

const searchQuery = ref('');
const showSearch = ref(false);
const catalogNavOpen = ref(false);
const solidHeader = ref(false);

function handleSearch() {
  if (searchQuery.value.trim()) {
    navigateTo(`/search?q=${encodeURIComponent(searchQuery.value.trim())}`);
    showSearch.value = false;
    catalogNavOpen.value = false;
  }
}

function onScroll() {
  if (!overlayMode.value) {
    solidHeader.value = true;
    return;
  }
  solidHeader.value = window.scrollY > 48;
}

const isLightOnHero = computed(() => overlayMode.value && !solidHeader.value && !showSearch.value);

onMounted(() => {
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <div :class="overlayMode ? 'fixed top-0 inset-x-0 z-[60]' : 'sticky top-0 z-50'">
    <AppAnnouncementBar />
    <header
      :class="[
        'transition-colors duration-300',
        isLightOnHero
          ? 'bg-transparent border-transparent text-white'
          : 'bg-surface-muted border-b border-primary-200/80 text-primary-900 shadow-sm',
      ]"
    >
      <div class="w-full px-4 md:px-8 lg:px-10">
        <div class="relative flex items-center justify-between h-14 md:h-[3.75rem]">
          <!-- راست: منو (RTL) -->
          <div class="flex items-center gap-1 z-10">
            <button
              type="button"
              :class="['p-2 -ms-1', isLightOnHero ? 'text-white' : 'text-primary-900']"
              aria-label="منو"
              @click="catalogNavOpen = !catalogNavOpen"
            >
              <AppIcon :name="catalogNavOpen ? 'lucide:x' : 'lucide:menu'" size="lg" />
            </button>
          </div>

          <!-- وسط: لوگو -->
          <div
            :class="[
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              isLightOnHero ? '[&_span]:text-white' : '',
            ]"
          >
            <AppLogo size="lg" link />
          </div>

          <!-- چپ: آیکون‌ها -->
          <div class="flex items-center gap-0.5 md:gap-1 z-10">
            <NuxtLink
              to="/cart"
              :class="['relative p-2', isLightOnHero ? 'text-white' : 'text-primary-900']"
              aria-label="سبد خرید"
            >
              <AppIcon name="lucide:shopping-bag" size="lg" />
              <span
                v-if="cartStore.totalItems > 0"
                class="badge absolute -top-0.5 -start-0.5 bg-primary-700 text-white"
              >
                {{ toPersianDigits(cartStore.totalItems) }}
              </span>
            </NuxtLink>
            <button
              type="button"
              :class="['p-2', isLightOnHero ? 'text-white' : 'text-primary-900']"
              aria-label="جستجو"
              @click="showSearch = !showSearch"
            >
              <AppIcon name="lucide:search" size="lg" />
            </button>
            <NuxtLink
              v-if="!authStore.isLoggedIn"
              to="/auth/login"
              :class="[
                'hidden sm:flex items-center gap-1.5 text-xs md:text-sm px-1 md:px-2',
                isLightOnHero ? 'text-white' : 'text-primary-900',
              ]"
            >
              <AppIcon name="lucide:user" size="md" />
              <span class="hidden lg:inline">ورود | ثبت‌نام</span>
            </NuxtLink>
            <NuxtLink
              v-else
              to="/profile"
              :class="[
                'hidden sm:flex items-center gap-1 p-1',
                isLightOnHero ? 'text-white' : 'text-primary-900',
              ]"
            >
              <AppIcon name="lucide:user-circle" size="md" />
            </NuxtLink>
          </div>
        </div>

        <div v-if="showSearch" class="pb-3 md:pb-4">
          <form class="relative max-w-xl mx-auto" @submit.prevent="handleSearch">
            <input
              v-model="searchQuery"
              type="search"
              :placeholder="`جستجو در ${SITE_NAME}...`"
              class="input-field pe-8"
              autofocus
            />
            <button type="submit" class="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-700">
              <AppIcon name="lucide:search" size="md" />
            </button>
          </form>
        </div>

      </div>
    </header>

    <CatalogNavDrawer :open="catalogNavOpen" @close="catalogNavOpen = false" />
  </div>
</template>
