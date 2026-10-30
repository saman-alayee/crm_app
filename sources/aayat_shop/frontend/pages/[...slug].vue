<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

definePageMeta({
  layout: false,
});

setResponseStatus(404);

useHead({
  title: `این استایل پیدا نشد - ${SITE_NAME}`,
});

function goHome() {
  navigateTo('/');
}

function goCategories() {
  navigateTo('/categories');
}
</script>

<template>
  <ErrorFashionScene
    :code="404"
    title="این استایل پیدا نشد"
    description="انگار این لباس از رگال برداشته شده. بروید کالکشن‌ها را ببینید یا به فروشگاه برگردید."
    eyebrow="OUT OF STOCK · PAGE"
    show-categories
    @home="goHome"
    @categories="goCategories"
  >
    <template #brand>
      <NuxtLink
        to="/"
        class="mb-8 inline-flex items-center gap-2 opacity-90 transition-opacity hover:opacity-100"
      >
        <img
          src="/logo.png"
          :alt="SITE_NAME"
          class="h-11 w-11 rounded-full object-cover ring-1 ring-primary-200/80"
          width="44"
          height="44"
        />
        <span class="text-sm font-semibold tracking-wide text-primary-900">{{ SITE_NAME }}</span>
      </NuxtLink>
    </template>
  </ErrorFashionScene>
</template>
