<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    description?: string;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function toggle() {
  if (props.disabled) return;
  emit('update:modelValue', !props.modelValue);
}

const thumbStyle = computed(() => ({
  insetInlineStart: props.modelValue ? 'calc(100% - 1.625rem - 2px)' : '2px',
}));
</script>

<template>
  <div
    :class="[
      'flex items-center justify-between gap-4 py-1',
      disabled ? 'opacity-50' : '',
    ]"
  >
    <div v-if="label || description" class="min-w-0 flex-1">
      <p v-if="label" class="text-sm font-medium text-gray-800">{{ label }}</p>
      <p v-if="description" class="text-xs text-gray-500 mt-0.5">{{ description }}</p>
    </div>

    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="[
        'relative w-12 h-7 rounded-full transition-colors duration-200 shrink-0',
        modelValue ? 'bg-primary-600' : 'bg-gray-200',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      ]"
      @click="toggle"
    >
      <span
        class="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-200"
        :style="thumbStyle"
      />
    </button>

    <input type="checkbox" class="sr-only" :checked="modelValue" :disabled="disabled" tabindex="-1" />
  </div>
</template>
