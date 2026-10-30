<script setup lang="ts">
import type { OrderStatus } from '~/types';
import { ORDER_STATUS_LABELS } from '~/types';

const props = defineProps<{
  status: OrderStatus;
}>();

const steps: OrderStatus[] = ['NEW', 'PREPARING', 'SHIPPED', 'DELIVERED'];

const stepIcons: Record<OrderStatus, string> = {
  NEW: 'lucide:clipboard-list',
  PREPARING: 'lucide:package-open',
  SHIPPED: 'lucide:truck',
  DELIVERED: 'lucide:circle-check-big',
  CANCELLED: 'lucide:circle-x',
};

const currentIndex = computed(() => {
  if (props.status === 'CANCELLED') return -1;
  return steps.indexOf(props.status);
});
</script>

<template>
  <div class="card p-4 mb-4">
    <div v-if="status === 'CANCELLED'" class="flex items-center gap-3 text-red-600">
      <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
        <AppIcon name="lucide:circle-x" size="md" />
      </div>
      <div>
        <p class="font-medium">سفارش لغو شده</p>
        <p class="text-xs text-red-400 mt-0.5">این سفارش دیگر پردازش نمی‌شود</p>
      </div>
    </div>

    <div v-else class="flex items-center justify-between gap-1">
      <div
        v-for="(step, index) in steps"
        :key="step"
        class="flex flex-col items-center flex-1 min-w-0"
      >
        <div
          :class="[
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
            index <= currentIndex ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400',
          ]"
        >
          <AppIcon :name="stepIcons[step]" size="sm" />
        </div>
        <p
          :class="[
            'text-[10px] mt-1.5 text-center leading-tight',
            index <= currentIndex ? 'text-primary-700 font-medium' : 'text-gray-400',
          ]"
        >
          {{ ORDER_STATUS_LABELS[step] }}
        </p>
      </div>
    </div>

    <div v-if="status !== 'CANCELLED'" class="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        class="h-full bg-primary-500 rounded-full transition-all duration-500"
        :style="{ width: `${Math.max(((currentIndex + 1) / steps.length) * 100, 12)}%` }"
      />
    </div>
  </div>
</template>
