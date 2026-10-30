<script setup lang="ts">
import type { AppNotification } from '~/types';
import { SITE_NAME } from '~/constants/site';

definePageMeta({ layout: 'profile', middleware: 'auth' });

const api = useApi();
const { formatShortDate } = useFormat();

const notifications = ref<AppNotification[]>([]);
const unreadCount = ref(0);
const loading = ref(true);

const typeIcons: Record<string, string> = {
  ORDER_STATUS: 'lucide:truck',
  GENERAL: 'lucide:info',
};

onMounted(loadNotifications);

async function loadNotifications() {
  loading.value = true;
  try {
    const { data } = await api.get<{
      notifications: AppNotification[];
      unreadCount: number;
    }>('/notifications');
    notifications.value = data.notifications;
    unreadCount.value = data.unreadCount;
  } finally {
    loading.value = false;
  }
}

async function markRead(id: string) {
  await api.put(`/notifications/${id}/read`);
  await loadNotifications();
}

async function markAllRead() {
  await api.put('/notifications/read-all');
  await loadNotifications();
}

useHead({ title: `اعلان‌ها - ${SITE_NAME}` });
</script>

<template>
  <div>
    <ProfilePageHeader title="اعلان‌ها" :subtitle="unreadCount ? `${unreadCount} پیام خوانده‌نشده` : 'همه پیام‌ها خوانده شده'" back-to="/profile">
      <template #action>
        <button
          v-if="unreadCount"
          class="text-sm text-primary-600 font-medium whitespace-nowrap"
          @click="markAllRead"
        >
          همه خوانده شد
        </button>
      </template>
    </ProfilePageHeader>

    <LoadingSpinner :show="loading" />

    <div v-if="!loading && notifications.length" class="space-y-3">
      <div
        v-for="item in notifications"
        :key="item.id"
        :class="[
          'card p-4 transition-all cursor-pointer',
          !item.isRead ? 'bg-primary-50/40 border border-primary-100 shadow-sm' : 'hover:bg-gray-50',
        ]"
        @click="!item.isRead && markRead(item.id)"
      >
        <div class="flex items-start gap-3">
          <div
            :class="[
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              !item.isRead ? 'bg-primary-100' : 'bg-gray-100',
            ]"
          >
            <AppIcon
              :name="typeIcons[item.type] || 'lucide:bell'"
              size="md"
              :class="!item.isRead ? 'text-primary-600' : 'text-gray-500'"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <p :class="['text-sm', !item.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700']">
                {{ item.title }}
              </p>
              <span v-if="!item.isRead" class="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />
            </div>
            <p class="text-sm text-gray-600 mt-1 leading-relaxed">{{ item.message }}</p>
            <p class="text-xs text-gray-400 mt-2">{{ formatShortDate(item.createdAt) }}</p>
            <NuxtLink
              v-if="item.orderId"
              :to="`/profile/orders/${item.orderId}`"
              class="inline-flex items-center gap-1 text-xs text-primary-600 font-medium mt-2 hover:underline"
              @click.stop
            >
              <AppIcon name="lucide:external-link" size="xs" />
              مشاهده سفارش
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!loading && !notifications.length" message="اعلانی ندارید" icon="lucide:bell-off">
      <p class="text-xs text-gray-400 mt-2">پس از ثبت سفارش، وضعیت ارسال اینجا نمایش داده می‌شود</p>
    </EmptyState>
  </div>
</template>
