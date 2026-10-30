<script setup lang="ts">
import type { SelectOption } from '~/components/AppSelect.vue';

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    searchable?: boolean;
    emptyText?: string;
    required?: boolean;
  }>(),
  {
    placeholder: 'انتخاب کنید',
    emptyText: 'موردی یافت نشد',
    searchable: true,
    disabled: false,
    required: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
  change: [value: string[]];
}>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const search = ref('');
const menuStyle = ref({ top: '0px', left: '0px', width: '0px', transform: '' });

const selectedOptions = computed(() =>
  props.options.filter((option) => props.modelValue.includes(String(option.value)))
);

const filteredOptions = computed(() => {
  if (!props.searchable || !search.value.trim()) return props.options;
  const query = search.value.trim().toLowerCase();
  return props.options.filter((option) => option.label.toLowerCase().includes(query));
});

const summaryLabel = computed(() => {
  if (!selectedOptions.value.length) return props.placeholder;
  if (selectedOptions.value.length === 1) return selectedOptions.value[0]?.label;
  return `${selectedOptions.value.length} مورد انتخاب شده`;
});

function updateMenuPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const menuHeight = 280;
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;

  menuStyle.value = {
    top: openUp ? `${rect.top - 8}px` : `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    transform: openUp ? 'translateY(-100%)' : '',
  };
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    search.value = '';
    nextTick(updateMenuPosition);
  }
}

function isSelected(value: string | number) {
  return props.modelValue.includes(String(value));
}

function toggleOption(option: SelectOption) {
  if (option.disabled) return;
  const value = String(option.value);
  const next = isSelected(value)
    ? props.modelValue.filter((item) => item !== value)
    : [...props.modelValue, value];
  emit('update:modelValue', next);
  emit('change', next);
}

function removeValue(value: string) {
  const next = props.modelValue.filter((item) => item !== value);
  emit('update:modelValue', next);
  emit('change', next);
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return;
  const target = event.target as Node;
  if (triggerRef.value?.contains(target)) return;
  const menu = document.getElementById(menuId);
  if (menu?.contains(target)) return;
  open.value = false;
}

const menuId = `app-multi-select-${Math.random().toString(36).slice(2, 9)}`;

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('resize', updateMenuPosition);
  window.addEventListener('scroll', updateMenuPosition, true);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
  window.removeEventListener('resize', updateMenuPosition);
  window.removeEventListener('scroll', updateMenuPosition, true);
});

watch(open, (isOpen) => {
  if (isOpen) nextTick(updateMenuPosition);
});
</script>

<template>
  <div ref="triggerRef" class="relative w-full">
    <input
      v-if="required"
      type="text"
      class="sr-only"
      tabindex="-1"
      :value="modelValue.length ? '1' : ''"
      required
    />

    <button
      type="button"
      :disabled="disabled"
      :class="[
        'input-field flex min-h-[42px] items-center justify-between gap-3 text-start',
        open ? 'border-neutral-950' : 'hover:border-neutral-500',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        !selectedOptions.length ? 'text-neutral-400' : 'text-neutral-900',
      ]"
      @click.stop="toggle"
    >
      <span class="min-w-0 truncate">{{ summaryLabel }}</span>
      <AppIcon
        name="lucide:chevron-down"
        size="sm"
        :class="['shrink-0 text-neutral-400 transition-transform duration-200', open ? 'rotate-180 text-neutral-950' : '']"
      />
    </button>

    <div v-if="selectedOptions.length" class="mt-2 flex flex-wrap gap-1.5">
      <button
        v-for="option in selectedOptions"
        :key="String(option.value)"
        type="button"
        class="inline-flex items-center gap-1 border border-neutral-300 px-2 py-1 text-[11px] tracking-wide text-neutral-800"
        @click="removeValue(String(option.value))"
      >
        {{ option.label }}
        <AppIcon name="lucide:x" size="xs" />
      </button>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95 -translate-y-1"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="open"
          :id="menuId"
          class="fixed z-[9999] overflow-hidden border border-neutral-200 bg-white"
          :style="menuStyle"
        >
          <div v-if="searchable" class="border-b border-neutral-200 px-3 py-2">
            <input
              v-model="search"
              type="search"
              class="input-field py-1.5 text-sm"
              placeholder="جستجو"
              @click.stop
            />
          </div>

          <ul class="max-h-60 overflow-y-auto py-1">
            <li v-if="!filteredOptions.length" class="px-3 py-3 text-center text-xs tracking-wide text-neutral-400">
              {{ emptyText }}
            </li>
            <li v-for="option in filteredOptions" :key="String(option.value)">
              <button
                type="button"
                :disabled="option.disabled"
                :class="[
                  'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-sm transition-colors',
                  isSelected(option.value)
                    ? 'font-medium text-neutral-950'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950',
                  option.disabled ? 'cursor-not-allowed opacity-40' : '',
                ]"
                @click="toggleOption(option)"
              >
                <span class="flex min-w-0 items-center gap-2 truncate">
                  <AppIcon
                    v-if="option.icon"
                    :name="option.icon"
                    size="sm"
                    :class="isSelected(option.value) ? 'text-neutral-950' : 'text-neutral-400'"
                  />
                  {{ option.label }}
                </span>
                <span
                  v-if="isSelected(option.value)"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-950"
                />
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
