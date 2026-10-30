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
</script>

<template>
  <label
    :class="[
      'flex items-start gap-3 select-none',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    @click.prevent="toggle"
  >
    <input
      type="checkbox"
      class="sr-only"
      :checked="modelValue"
      :disabled="disabled"
      tabindex="-1"
    />
    <span
      :class="[
        'w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 mt-0.5',
        modelValue
          ? 'bg-primary-600 border-primary-600 shadow-sm shadow-primary-200'
          : 'border-gray-300 bg-white hover:border-gray-400',
      ]"
    >
      <AppIcon v-if="modelValue" name="lucide:check" size="sm" class="text-white" />
    </span>
    <span v-if="label || description || $slots.default" class="min-w-0">
      <span v-if="label" class="text-sm font-medium text-gray-800 block">{{ label }}</span>
      <p v-if="description" class="text-xs text-gray-500 mt-0.5 leading-relaxed">{{ description }}</p>
      <slot />
    </span>
  </label>
</template>
