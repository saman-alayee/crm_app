<script setup lang="ts">
import {
  ENAMAD,
  SITE_NAME,
  SITE_TAGLINE,
  SOCIAL_LINKS,
  STORE_HOURS,
} from '~/constants/site';

const { formatJalaliYear } = useFormat();

const aboutLinks = [
  { to: '/pages/about', label: 'درباره ما' },
  { to: '/contact', label: 'تماس با ما' },
  { to: '/pages/terms', label: 'قوانین و مقررات' },
];

const shopLinks = [
  { to: '/categories', label: 'کالکشن‌ها' },
  { to: '/search?sort=newest', label: 'جدیدترین محصولات' },
  { to: '/search?discounted=1', label: 'پیشنهاد ویژه' },
  { to: '/profile/orders', label: 'پیگیری سفارش' },
];

const channels = [
  { href: SOCIAL_LINKS.whatsapp, label: 'واتساپ' },
  { href: SOCIAL_LINKS.whatsappGroup, label: 'گروه واتساپ' },
  { href: SOCIAL_LINKS.rubikaChannel, label: 'کانال روبیکا' },
  { href: SOCIAL_LINKS.rubikaAdmin, label: 'ادمین روبیکا' },
];
</script>

<template>
  <footer class="mt-12 border-t border-primary-200/80 bg-[#efe8df] pb-24 md:pb-0">
    <div class="max-w-store mx-auto px-4 py-10">
      <div class="grid grid-cols-1 gap-8 md:grid-cols-4">
        <div>
          <AppLogo size="sm" />
          <p class="mt-3 text-sm leading-relaxed text-gray-600">{{ SITE_TAGLINE }}</p>
          <a
            :href="ENAMAD.href"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-4 inline-block"
            aria-label="نماد اعتماد الکترونیکی"
          >
            <img src="/enamad.png" alt="نماد اعتماد الکترونیکی" width="125" height="136" class="h-24 w-auto" />
          </a>
        </div>
        <div>
          <h3 class="mb-3 text-sm font-bold text-gray-900">فروشگاه</h3>
          <nav class="flex flex-col gap-2 text-sm text-gray-600">
            <NuxtLink v-for="link in shopLinks" :key="link.to" :to="link.to" class="hover:text-primary-700">
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>
        <div>
          <h3 class="mb-3 text-sm font-bold text-gray-900">اطلاعات</h3>
          <nav class="flex flex-col gap-2 text-sm text-gray-600">
            <NuxtLink v-for="link in aboutLinks" :key="link.to" :to="link.to" class="hover:text-primary-700">
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>
        <div>
          <h3 class="mb-3 text-sm font-bold text-gray-900">پشتیبانی و کانال‌ها</h3>
          <p class="text-sm leading-relaxed text-gray-600">{{ STORE_HOURS }}</p>
          <nav class="mt-3 flex flex-col gap-2 text-sm text-gray-600">
            <a
              v-for="channel in channels"
              :key="channel.href"
              :href="channel.href"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-primary-700"
            >
              {{ channel.label }}
            </a>
          </nav>
        </div>
      </div>
      <p class="mt-10 border-t border-gray-200 pt-6 text-xs text-gray-400">
        © {{ formatJalaliYear() }} {{ SITE_NAME }}
      </p>
    </div>
  </footer>
</template>
