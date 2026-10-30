<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

const email = ref('');
const sent = ref(false);

function submit() {
  if (!email.value.trim()) return;
  sent.value = true;
}
</script>

<template>
  <section class="px-5 md:px-8 lg:px-10 py-10 md:py-14 border-t border-gray-100">
    <div class="max-w-3xl mx-auto text-center md:text-start md:flex md:items-center md:justify-between gap-6">
      <div class="md:max-w-md">
        <h2 class="text-lg font-bold text-gray-900">خبرنامه {{ SITE_NAME }}</h2>
        <p class="text-sm text-gray-600 mt-2 leading-relaxed">
          از جدیدترین کالکشن‌ها، تخفیف‌ها و پیشنهادهای ویژه باخبر شوید.
        </p>
      </div>
      <form v-if="!sent" class="mt-5 md:mt-0 flex flex-col sm:flex-row gap-2 md:flex-1 md:max-w-md" @submit.prevent="submit">
        <input
          v-model="email"
          type="email"
          required
          placeholder="پست الکترونیک"
          class="input-field flex-1 bg-surface-muted"
        />
        <button type="submit" class="btn-primary shrink-0 px-8">عضویت</button>
      </form>
      <p v-else class="text-sm text-primary-700 font-medium mt-4 md:mt-0">درخواست شما ثبت شد.</p>
    </div>
  </section>
</template>
