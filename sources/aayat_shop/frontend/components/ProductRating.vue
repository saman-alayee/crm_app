<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: number;
    count?: number;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'sm' },
);

const { toPersianDigits } = useFormat();

const rounded = computed(() => Math.round(props.value));
const starClass = computed(() => {
  if (props.size === 'lg') return 'h-6 w-6';
  if (props.size === 'md') return 'h-5 w-5';
  return 'h-3.5 w-3.5';
});
const label = computed(() => {
  const score = toPersianDigits(props.value ? props.value.toFixed(1) : '0');
  const count = props.count == null ? '' : ` از ${toPersianDigits(props.count)} نظر`;
  return `امتیاز ${score} از ۵${count}`;
});
</script>

<template>
  <span class="inline-flex items-center gap-1.5" :aria-label="label">
    <span class="inline-flex gap-0.5" aria-hidden="true">
      <svg
        v-for="n in 5"
        :key="n"
        :class="starClass"
        viewBox="0 0 20 20"
      >
        <path
          :fill="n <= rounded ? '#c4922a' : '#e7e5e4'"
          d="M10 1.8l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 12.6 5.8 14.8l.8-4.7L3.2 6.8l4.7-.7L10 1.8z"
        />
      </svg>
    </span>
    <span
      v-if="count != null"
      :class="size === 'lg' ? 'text-sm text-neutral-500' : 'text-[11px] leading-none text-neutral-500'"
    >
      {{ toPersianDigits(count) }}
    </span>
  </span>
</template>
