<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    icon?: string;
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
  <button
    type="button"
    :disabled="disabled"
    :class="[
      'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200',
      modelValue
        ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-sm'
        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95',
    ]"
    @click="toggle"
  >
    <AppIcon
      v-if="modelValue"
      name="lucide:check"
      size="sm"
      class="text-primary-600"
    />
    <AppIcon
      v-else-if="icon"
      :name="icon"
      size="sm"
      class="text-gray-400"
    />
    {{ label }}
  </button>
</template>
