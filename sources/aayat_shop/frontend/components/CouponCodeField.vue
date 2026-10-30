<script setup lang="ts">
const props = defineProps<{
  subtotal: number;
  phone?: string;
}>();

const { formatPrice } = useFormat();
const { code, applying, error, applied, apply, clear } = useCoupon();

async function submit() {
  await apply(props.subtotal, props.phone);
}
</script>

<template>
  <div>
    <label class="mb-1.5 block text-sm font-medium text-[#3c322b]">کد تخفیف</label>
    <div class="flex gap-2">
      <input
        v-model="code"
        type="text"
        class="input-field"
        dir="ltr"
        placeholder="مثلاً WELCOME10"
        :disabled="applying"
        @keyup.enter="submit"
      />
      <button type="button" class="btn-secondary shrink-0 px-4 text-sm" :disabled="applying" @click="submit">
        {{ applying ? '...' : 'اعمال' }}
      </button>
    </div>
    <p v-if="error" class="mt-2 text-xs leading-5 text-red-600">{{ error }}</p>
    <div v-else-if="applied" class="mt-2 flex items-center justify-between gap-2 text-xs text-green-700">
      <span>کد {{ applied.code }} اعمال شد؛ {{ formatPrice(applied.discountAmount) }} تخفیف</span>
      <button type="button" class="text-gray-500 underline" @click="clear">حذف</button>
    </div>
  </div>
</template>
