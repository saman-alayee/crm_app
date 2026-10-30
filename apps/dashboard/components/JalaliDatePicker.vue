<script setup lang="ts">
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  formatJalaliInputValue,
  getJalaliMonthLength,
  getJalaliWeekdayIndex,
  getTodayGregorianIso,
  getTodayJalali,
  gregorianIsoToJalali,
  jalaliToGregorianIso,
  parseJalaliDisplayToIso,
  toPersianDigits,
} from '~/utils/jalali';

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    min?: string;
    max?: string;
  }>(),
  {
    modelValue: '',
    placeholder: 'مثلاً ۱۴۰۳/۰۱/۱۵',
    disabled: false,
    invalid: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const typed = ref('');
const view = reactive({ year: 1403, month: 1 });

const display = computed(() =>
  props.modelValue ? formatJalaliInputValue(props.modelValue) : typed.value,
);

const selected = computed(() => {
  if (!props.modelValue) return null;
  return gregorianIsoToJalali(props.modelValue.slice(0, 10));
});

const cells = computed(() => {
  const days = getJalaliMonthLength(view.year, view.month);
  const start = getJalaliWeekdayIndex(view.year, view.month, 1);
  const list: ({ day: number; iso: string } | null)[] = [];
  for (let i = 0; i < start; i++) list.push(null);
  for (let d = 1; d <= days; d++) {
    list.push({ day: d, iso: jalaliToGregorianIso(view.year, view.month, d) });
  }
  return list;
});

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      const j = gregorianIsoToJalali(v.slice(0, 10));
      view.year = j.year;
      view.month = j.month;
      typed.value = '';
    }
  },
  { immediate: true },
);

function syncViewFromToday() {
  const t = getTodayJalali();
  view.year = t.year;
  view.month = t.month;
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value && !props.modelValue) syncViewFromToday();
}

function prevMonth() {
  if (view.month === 1) {
    view.month = 12;
    view.year -= 1;
  } else view.month -= 1;
}

function nextMonth() {
  if (view.month === 12) {
    view.month = 1;
    view.year += 1;
  } else view.month += 1;
}

function isDisabledIso(iso: string) {
  if (props.min && iso < props.min.slice(0, 10)) return true;
  if (props.max && iso > props.max.slice(0, 10)) return true;
  return false;
}

function pick(iso: string) {
  if (isDisabledIso(iso)) return;
  emit('update:modelValue', iso);
  typed.value = '';
  open.value = false;
}

function pickToday() {
  pick(getTodayGregorianIso());
}

function clear() {
  emit('update:modelValue', '');
  typed.value = '';
  open.value = false;
}

function onTypedInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  typed.value = raw;
  const iso = parseJalaliDisplayToIso(raw);
  if (iso && !isDisabledIso(iso)) {
    emit('update:modelValue', iso);
  } else if (!raw.trim()) {
    emit('update:modelValue', '');
  }
}

function onBlur() {
  if (typed.value && !parseJalaliDisplayToIso(typed.value)) {
    typed.value = props.modelValue ? formatJalaliInputValue(props.modelValue) : '';
  }
  emit('blur');
}

function onDocClick(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div ref="root" class="jdp">
    <div class="jdp__control">
      <input
        class="input-field jdp__input"
        :class="{ 'input-invalid': invalid }"
        type="text"
        inputmode="numeric"
        :disabled="disabled"
        :placeholder="placeholder"
        :value="display"
        @focus="open = true"
        @input="onTypedInput"
        @blur="onBlur"
      />
      <button class="jdp__icon-btn" type="button" :disabled="disabled" title="تقویم" @click.stop="toggle">
        <AppIcon name="lucide:calendar" size="sm" />
      </button>
    </div>

    <div v-if="open" class="jdp__pop" @click.stop>
      <div class="jdp__head">
        <button class="jdp__nav" type="button" @click="prevMonth">
          <AppIcon name="lucide:chevron-right" size="sm" />
        </button>
        <p class="jdp__title">
          {{ JALALI_MONTHS[view.month - 1] }}
          {{ toPersianDigits(view.year) }}
        </p>
        <button class="jdp__nav" type="button" @click="nextMonth">
          <AppIcon name="lucide:chevron-left" size="sm" />
        </button>
      </div>

      <div class="jdp__week">
        <span v-for="w in JALALI_WEEKDAYS" :key="w">{{ w }}</span>
      </div>

      <div class="jdp__grid">
        <button
          v-for="(cell, idx) in cells"
          :key="idx"
          type="button"
          class="jdp__day"
          :class="{
            'is-empty': !cell,
            'is-selected': cell && selected && cell.iso === modelValue?.slice(0, 10),
            'is-today': cell && cell.iso === getTodayGregorianIso(),
            'is-disabled': cell && isDisabledIso(cell.iso),
          }"
          :disabled="!cell || isDisabledIso(cell.iso)"
          @click="cell && pick(cell.iso)"
        >
          <template v-if="cell">{{ toPersianDigits(cell.day) }}</template>
        </button>
      </div>

      <div class="jdp__foot">
        <button class="btn-ghost !text-xs" type="button" @click="clear">پاک کردن</button>
        <button class="btn-soft !py-1 !text-xs" type="button" @click="pickToday">امروز</button>
      </div>
    </div>
  </div>
</template>
