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
const pop = ref<HTMLElement | null>(null);
const typed = ref('');
const view = reactive({ year: 1403, month: 1 });
const popStyle = ref<Record<string, string>>({});

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

function placePop() {
  const el = root.value;
  if (!el || typeof window === 'undefined') return;
  const rect = el.getBoundingClientRect();
  const width = Math.min(18.5 * 16, window.innerWidth - 16);
  const popH = pop.value?.offsetHeight || 320;
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < popH + 12 && rect.top > popH + 12;

  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  if (left < 8) left = 8;

  const top = openUp ? rect.top - popH - 6 : rect.bottom + 6;

  popStyle.value = {
    position: 'fixed',
    top: `${Math.max(8, top)}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: '80',
  };
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value && !props.modelValue) syncViewFromToday();
  if (open.value) nextTick(() => placePop());
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

function onFocus() {
  open.value = true;
  if (!props.modelValue) syncViewFromToday();
  nextTick(() => placePop());
}

function onDocClick(e: MouseEvent) {
  const t = e.target as Node;
  if (root.value?.contains(t) || pop.value?.contains(t)) return;
  open.value = false;
}

function onScrollOrResize() {
  if (open.value) placePop();
}

watch(open, (v) => {
  if (v) nextTick(() => placePop());
});

onMounted(() => {
  document.addEventListener('click', onDocClick);
  window.addEventListener('resize', onScrollOrResize);
  window.addEventListener('scroll', onScrollOrResize, true);
});
onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  window.removeEventListener('resize', onScrollOrResize);
  window.removeEventListener('scroll', onScrollOrResize, true);
});
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
        @focus="onFocus"
        @input="onTypedInput"
        @blur="onBlur"
      />
      <button class="jdp__icon-btn" type="button" :disabled="disabled" title="تقویم" @click.stop="toggle">
        <AppIcon name="lucide:calendar" size="sm" />
      </button>
    </div>

    <Teleport to="body">
      <div v-if="open" ref="pop" class="jdp__pop jdp__pop--portal" :style="popStyle" @click.stop>
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
    </Teleport>
  </div>
</template>
