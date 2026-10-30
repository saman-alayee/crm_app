<script setup lang="ts">
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    searchable?: boolean;
    emptyText?: string;
    required?: boolean;
    invalid?: boolean;
  }>(),
  {
    placeholder: 'انتخاب کنید',
    emptyText: 'موردی یافت نشد',
    searchable: false,
    disabled: false,
    required: false,
    invalid: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  change: [value: string | number];
}>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const search = ref('');
const menuStyle = ref({ top: '0px', left: '0px', width: '0px', transform: '' });

const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.modelValue)
);

const filteredOptions = computed(() => {
  if (!props.searchable || !search.value.trim()) return props.options;
  const query = search.value.trim().toLowerCase();
  return props.options.filter((option) => option.label.toLowerCase().includes(query));
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

function select(option: SelectOption) {
  if (option.disabled) return;
  emit('update:modelValue', option.value);
  emit('change', option.value);
  open.value = false;
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return;
  const target = event.target as Node;
  if (triggerRef.value?.contains(target)) return;
  const menu = document.getElementById(menuId);
  if (menu?.contains(target)) return;
  open.value = false;
}

const menuId = `app-select-${Math.random().toString(36).slice(2, 9)}`;

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
      :value="modelValue ?? ''"
      required
    />

    <button
      type="button"
      :disabled="disabled"
      :class="[
        'input-field flex items-center justify-between gap-3 text-start',
        open ? 'border-neutral-950' : 'hover:border-neutral-500',
        invalid ? 'input-invalid' : '',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        !selectedOption ? 'text-neutral-400' : 'text-neutral-900',
      ]"
      @click.stop="toggle"
    >
      <span class="flex items-center gap-2 min-w-0 truncate">
        <AppIcon
          v-if="selectedOption?.icon"
          :name="selectedOption.icon"
          size="sm"
          class="text-gray-500 shrink-0"
        />
        {{ selectedOption?.label || placeholder }}
      </span>
      <AppIcon
        name="lucide:chevron-down"
        size="sm"
        :class="['text-neutral-400 shrink-0 transition-transform duration-200', open ? 'rotate-180 text-neutral-950' : '']"
      />
    </button>

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
                  option.value === modelValue
                    ? 'font-medium text-neutral-950'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950',
                  option.disabled ? 'cursor-not-allowed opacity-40' : '',
                ]"
                @click="select(option)"
              >
                <span class="flex min-w-0 items-center gap-2 truncate">
                  <AppIcon
                    v-if="option.icon"
                    :name="option.icon"
                    size="sm"
                    :class="option.value === modelValue ? 'text-neutral-950' : 'text-neutral-400'"
                  />
                  {{ option.label }}
                </span>
                <span
                  v-if="option.value === modelValue"
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
