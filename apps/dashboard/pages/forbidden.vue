<script setup lang="ts">
definePageMeta({ layout: false });
const auth = useAuthStore();
useHead({ title: 'عدم دسترسی' });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4" style="background: var(--hr-surface); color: var(--hr-text)">
    <div class="card max-w-md p-8 text-center">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
        <AppIcon name="lucide:shield-off" size="lg" />
      </div>
      <h1 class="text-lg font-bold">دسترسی مجاز نیست</h1>
      <p class="mt-2 text-sm" style="color: var(--hr-muted)">
        برای این بخش مجوز ندارید. در صورت نیاز از مالک یا ادمین بخواهید دسترسی بدهد.
      </p>
      <div class="mt-6 flex justify-center gap-2">
        <NuxtLink :to="auth.homePath()" class="btn-primary">بازگشت</NuxtLink>
        <button class="btn-secondary" type="button" @click="auth.logout().then(() => navigateTo('/login'))">خروج</button>
      </div>
    </div>
  </div>
</template>
