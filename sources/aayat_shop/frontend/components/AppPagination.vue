<script setup lang="ts">
import type { Pagination } from '~/types';

const props = withDefaults(
  defineProps<{
    pagination: Pagination | null;
    /** Compact for admin tables */
    compact?: boolean;
  }>(),
  { compact: false }
);

const emit = defineEmits<{
  'update:page': [page: number];
}>();

const { formatNumber } = useFormat();

const canPrev = computed(() => (props.pagination?.page ?? 1) > 1);
const canNext = computed(
  () => (props.pagination?.page ?? 1) < (props.pagination?.totalPages ?? 1)
);

const pageButtons = computed(() => {
  const total = props.pagination?.totalPages ?? 0;
  const current = props.pagination?.page ?? 1;
  if (total <= 1) return [] as number[];

  const max = 5;
  let start = Math.max(1, current - Math.floor(max / 2));
  let end = Math.min(total, start + max - 1);
  start = Math.max(1, end - max + 1);

  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

function go(page: number) {
  if (!props.pagination) return;
  if (page < 1 || page > props.pagination.totalPages || page === props.pagination.page) return;
  emit('update:page', page);
}
</script>

<template>
  <div
    v-if="pagination && pagination.totalPages > 1"
    :class="[
      'flex flex-wrap items-center justify-between gap-3',
      compact ? 'mt-4' : 'mt-6',
    ]"
  >
    <p class="text-xs text-gray-500">
      {{ formatNumber(pagination.total) }} مورد —
      صفحه {{ formatNumber(pagination.page) }} از {{ formatNumber(pagination.totalPages) }}
    </p>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="px-2.5 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50"
        :disabled="!canPrev"
        @click="go(pagination.page - 1)"
      >
        قبلی
      </button>

      <button
        v-for="p in pageButtons"
        :key="p"
        type="button"
        :class="[
          'min-w-[2rem] px-2 py-1.5 rounded-lg text-sm border transition-colors',
          p === pagination.page
            ? 'bg-primary-600 text-white border-primary-600'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
        ]"
        @click="go(p)"
      >
        {{ formatNumber(p) }}
      </button>

      <button
        type="button"
        class="px-2.5 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50"
        :disabled="!canNext"
        @click="go(pagination.page + 1)"
      >
        بعدی
      </button>
    </div>
  </div>
</template>
