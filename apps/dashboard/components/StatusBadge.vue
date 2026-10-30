<script setup lang="ts">
const props = defineProps<{ status: string }>();

const map: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'در انتظار', class: 'badge-pending' },
  APPROVED: { label: 'تأییدشده', class: 'badge-approved' },
  REJECTED: { label: 'ردشده', class: 'badge-rejected' },
  COMPLETED: { label: 'انجام‌شده', class: 'badge-approved' },
  IN_PROGRESS: { label: 'در حال انجام', class: 'badge-info' },
  CANCELLED: { label: 'لغو شده', class: 'badge-rejected' },
  LOW: { label: 'کم', class: 'badge-neutral' },
  MEDIUM: { label: 'متوسط', class: 'badge-pending' },
  HIGH: { label: 'بالا', class: 'badge-pending' },
  URGENT: { label: 'فوری', class: 'badge-rejected' },
  HOURLY: { label: 'ساعتی', class: 'badge-info' },
  DAILY: { label: 'روزانه', class: 'badge-info' },
  SALARY: { label: 'حقوق', class: 'badge-approved' },
  ADVANCE: { label: 'مساعده', class: 'badge-info' },
};

const item = computed(() => map[props.status] || { label: props.status, class: 'badge-neutral' });
</script>

<template>
  <span class="badge" :class="item.class">{{ item.label }}</span>
</template>
