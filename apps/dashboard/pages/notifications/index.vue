<script setup lang="ts">
const { api } = useApi();
const toast = useToast();
const { formatDate } = useFormat();
const loading = ref(true);
const items = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    const res = await api<{ success: boolean; data: { items: any[] } }>('/notifications?limit=50');
    items.value = res.data.items;
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function markRead(id: string) {
  await api(`/notifications/${id}/read`, { method: 'POST' });
  await load();
}

async function markAll() {
  await api('/notifications/read-all', { method: 'POST' });
  toast.success('همه خوانده شد');
  await load();
}

onMounted(load);
useHead({ title: 'اعلان‌ها' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="ارتباطات"
      title="اعلان‌ها"
      subtitle="پیام‌های سیستم، مرخصی، مالی و مدیران برای شما"
    >
      <template #actions>
        <button class="btn-secondary" type="button" @click="markAll">خواندن همه</button>
      </template>
    </UiPageHeader>

    <UiHelpBanner
      storage-key="notifications"
      title="راهنمای اعلان‌ها"
      :steps="[
        'اعلان‌های خوانده‌نشده با نوار آبی و برچسب «جدید» مشخص‌اند.',
        'روی هر اعلان بزنید تا خوانده شود.',
        'زنگوله بالای صفحه هم تعداد خوانده‌نشده را نشان می‌دهد.',
      ]"
    />

    <LoadingSpinner v-if="loading" />
    <EmptyState
      v-else-if="!items.length"
      title="اعلانی نیست"
      message="هنوز پیامی برای شما نیامده"
      tip="وقتی مرخصی یا وظیفه جدیدی باشد، اینجا ظاهر می‌شود."
      icon="lucide:bell-off"
    />
    <div v-else class="space-y-2">
      <button
        v-for="n in items"
        :key="n.id"
        type="button"
        class="card w-full p-4 text-start transition hover:opacity-95"
        :style="n.isRead ? { opacity: 0.72 } : { boxShadow: 'inset 3px 0 0 var(--hr-btn)' }"
        @click="markRead(n.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold">{{ n.title }}</p>
            <p class="mt-1 text-sm" style="color: var(--hr-muted)">{{ n.body }}</p>
            <p class="mt-2 text-xs" style="color: var(--hr-muted)">{{ formatDate(n.createdAt) }}</p>
          </div>
          <span v-if="!n.isRead" class="badge badge-info">جدید</span>
        </div>
      </button>
    </div>
  </div>
</template>
