<script setup lang="ts">
import type { NuxtError } from '#app';
import { SITE_NAME } from '~/constants/site';

const props = defineProps<{ error: NuxtError }>();

const is404 = computed(() => props.error?.statusCode === 404);

const title = computed(() =>
  is404.value ? 'این استایل پیدا نشد' : 'یک دوخت از دست رفت'
);

const description = computed(() => {
  if (is404.value) {
    return 'انگار این لباس از رگال برداشته شده. بروید کالکشن‌ها را ببینید یا به فروشگاه برگردید.';
  }
  return (
    props.error?.statusMessage ||
    props.error?.message ||
    'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.'
  );
});

function goHome() {
  clearError({ redirect: '/' });
}

function goCategories() {
  clearError({ redirect: '/categories' });
}

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    clearError();
    window.history.back();
    return;
  }
  goHome();
}
</script>

<template>
  <ErrorFashionScene
    :code="error?.statusCode || 404"
    :title="title"
    :description="description"
    :eyebrow="is404 ? 'OUT OF STOCK · PAGE' : 'ALTERATION NEEDED'"
    :show-categories="is404"
    @home="goHome"
    @categories="goCategories"
    @back="goBack"
  >
    <template #brand>
      <button
        type="button"
        class="mb-8 inline-flex items-center gap-2 opacity-90 transition-opacity hover:opacity-100"
        @click="goHome"
      >
        <img
          src="/logo.png"
          :alt="SITE_NAME"
          class="h-11 w-11 rounded-full object-cover ring-1 ring-primary-200/80"
          width="44"
          height="44"
        />
        <span class="text-sm font-semibold tracking-wide text-primary-900">{{ SITE_NAME }}</span>
      </button>
    </template>
  </ErrorFashionScene>
</template>
