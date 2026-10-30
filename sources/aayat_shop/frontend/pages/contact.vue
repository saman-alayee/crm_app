<script setup lang="ts">
import { ENAMAD, SOCIAL_LINKS, STORE_HOURS } from '~/constants/site';

const channels = [
  { label: 'واتساپ', value: 'پیام در واتساپ', href: SOCIAL_LINKS.whatsapp },
  { label: 'آیدی ادمین در روبیکا', value: 'Aytay_irr', href: SOCIAL_LINKS.rubikaAdmin },
  { label: 'کانال روبیکا', value: 'aytayir', href: SOCIAL_LINKS.rubikaChannel },
  { label: 'گروه واتساپ', value: 'ورود به گروه', href: SOCIAL_LINKS.whatsappGroup },
];

usePageSeo({
  title: 'تماس با ما',
  description: 'ارتباط با فروشگاه آیتای از واتساپ و روبیکا.',
  path: '/contact',
});
</script>

<template>
  <div class="mx-auto max-w-lg px-4 py-6 pb-24">
    <h1 class="section-title">تماس با ما</h1>
    <p class="mb-6 text-sm leading-relaxed text-gray-600">
      برای ارتباط با ما و دریافت پاسخ سریع، لطفاً از طریق واتساپ و روبیکا پیام بدید. با کمال میل پاسخگوی شما هستیم.
    </p>

    <div class="card mb-4 space-y-4 p-4">
      <div v-for="channel in channels" :key="channel.href" class="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
        <p class="mb-1 text-xs text-gray-500">{{ channel.label }}</p>
        <a :href="channel.href" target="_blank" rel="noopener noreferrer" class="text-base font-bold text-primary-700" dir="ltr">
          {{ channel.value }}
        </a>
      </div>

      <div class="border-t border-gray-100 pt-3">
        <p class="mb-1 text-xs text-gray-500">آدرس حضوری</p>
        <p class="text-sm leading-relaxed text-gray-800">جهت ارسال آدرس حضوری در روبیکا پیام دهید.</p>
      </div>

      <div class="border-t border-gray-100 pt-3">
        <p class="mb-1 text-xs text-gray-500">ساعات کاری فروشگاه</p>
        <p class="text-sm font-medium leading-relaxed text-gray-800">{{ STORE_HOURS }}</p>
      </div>
    </div>

    <p class="mb-4 text-sm leading-relaxed text-gray-600">
      برای اینکه زودتر از رسیدن بارهای جدید و شارژهای تازه باخبر بشین، حتماً عضو گروه واتساپ و کانال روبیکا بشین.
    </p>

    <a
      :href="ENAMAD.href"
      target="_blank"
      rel="noopener noreferrer"
      class="mb-6 inline-block"
      aria-label="نماد اعتماد الکترونیکی"
    >
      <img src="/enamad.png" alt="نماد اعتماد الکترونیکی" width="125" height="136" class="h-28 w-auto" />
    </a>

    <NuxtLink to="/" class="btn-secondary inline-flex min-h-[48px] w-full items-center justify-center">
      بازگشت به فروشگاه
    </NuxtLink>
  </div>
</template>
