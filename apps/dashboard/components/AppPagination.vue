<script setup lang="ts">
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const props = withDefaults(
  defineProps<{
    pagination: Pagination | null;
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
    :class="['flex flex-wrap items-center justify-end gap-2', compact ? '' : 'mt-4']"
  >
    <button type="button" class="btn-icon" :disabled="!canPrev" title="قبلی" @click="go(pagination.page - 1)">
      <AppIcon name="lucide:chevron-right" size="sm" />
    </button>

    <button
      v-for="p in pageButtons"
      :key="p"
      type="button"
      class="filter-chip min-w-[2rem] justify-center"
      :class="{ 'is-active': p === pagination.page }"
      @click="go(p)"
    >
      {{ formatNumber(p) }}
    </button>

    <button type="button" class="btn-icon" :disabled="!canNext" title="بعدی" @click="go(pagination.page + 1)">
      <AppIcon name="lucide:chevron-left" size="sm" />
    </button>
  </div>
</template>
