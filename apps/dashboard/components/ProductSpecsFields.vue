<script setup lang="ts">
const props = defineProps<{
  productKind: 'PHONE' | 'SIM';
  modelValue: Record<string, any>;
  options?: any[];
}>();

const emit = defineEmits<{ 'update:modelValue': [Record<string, any>] }>();

const specs = computed({
  get: () => props.modelValue || {},
  set: (v) => emit('update:modelValue', v),
});

function setField(key: string, value: string) {
  specs.value = { ...specs.value, [key]: value };
}

function opts(category: string) {
  return (props.options || []).filter(
    (o) => o.kind === props.productKind && o.category === category && o.isActive !== false
  );
}

const phoneFields = [
  { key: 'brand', label: 'برند', category: 'brand' },
  { key: 'model', label: 'مدل', category: '' },
  { key: 'storage', label: 'حافظه', category: 'storage' },
  { key: 'color', label: 'رنگ', category: 'color' },
  { key: 'ram', label: 'رم', category: '' },
];

const simFields = [
  { key: 'operator', label: 'اپراتور', category: 'operator' },
  { key: 'type', label: 'نوع', category: 'type' },
  { key: 'plan', label: 'پلن/رند', category: 'plan' },
];

const fields = computed(() => (props.productKind === 'SIM' ? simFields : phoneFields));
</script>

<template>
  <div class="grid gap-3 md:grid-cols-2">
    <div v-for="f in fields" :key="f.key">
      <label class="field-label">{{ f.label }}</label>
      <select
        v-if="f.category && opts(f.category).length"
        class="input-field"
        :value="specs[f.key] || ''"
        @change="setField(f.key, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">انتخاب کنید</option>
        <option v-for="o in opts(f.category)" :key="o.id" :value="o.value">{{ o.value }}</option>
      </select>
      <input
        v-else
        class="input-field"
        :value="specs[f.key] || ''"
        :placeholder="f.label"
        @input="setField(f.key, ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>
