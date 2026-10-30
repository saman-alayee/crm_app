<script setup lang="ts">
import { combineDateAndTime, splitDateTimeLocal } from '~/utils/jalali';

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    disabled?: boolean;
    invalid?: boolean;
  }>(),
  { modelValue: '', disabled: false, invalid: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>();

const parts = computed(() => splitDateTimeLocal(props.modelValue || ''));

function onDate(iso: string) {
  if (!iso) {
    emit('update:modelValue', '');
    return;
  }
  emit('update:modelValue', combineDateAndTime(iso, parts.value.time || '09:00'));
}

function onTime(e: Event) {
  const time = (e.target as HTMLInputElement).value;
  if (!parts.value.date) {
    // keep time only until date picked — still emit empty date combo skipped
    return;
  }
  emit('update:modelValue', combineDateAndTime(parts.value.date, time || '00:00'));
}
</script>

<template>
  <div class="jdt">
    <JalaliDatePicker
      :model-value="parts.date"
      :disabled="disabled"
      :invalid="invalid"
      @update:model-value="onDate"
      @blur="emit('blur')"
    />
    <input
      class="input-field jdt__time"
      :class="{ 'input-invalid': invalid }"
      type="time"
      :disabled="disabled || !parts.date"
      :value="parts.time"
      @input="onTime"
      @blur="emit('blur')"
    />
  </div>
</template>

<style scoped>
.jdt {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: start;
}
.jdt__time {
  width: 7.5rem;
}
@media (max-width: 480px) {
  .jdt {
    grid-template-columns: 1fr;
  }
  .jdt__time {
    width: 100%;
  }
}
</style>
