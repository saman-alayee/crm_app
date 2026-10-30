<script setup lang="ts">
const router = useRouter();

function goBack() {
  if (import.meta.client && window.history.length > 1) router.back();
  else navigateTo('/');
}
</script>

<template>
  <div class="mb-3 flex flex-wrap items-center gap-2">
    <button class="btn-ghost" type="button" @click="goBack">
      <AppIcon name="lucide:arrow-right" size="sm" />
      بازگشت
    </button>
    <NuxtLink class="btn-soft" to="/">
      <AppIcon name="lucide:home" size="sm" />
      خانه
    </NuxtLink>
  </div>
</template>
