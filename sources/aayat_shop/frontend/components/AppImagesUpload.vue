<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string[];
    uploadEndpoint: string;
    label?: string;
    hint?: string;
    maxImages?: number;
    accept?: string;
  }>(),
  {
    label: 'تصاویر',
    hint: 'JPEG, PNG, WebP یا GIF — حداکثر ۵ مگابایت',
    maxImages: 8,
    accept: 'image/jpeg,image/png,image/webp,image/gif',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const api = useApi();
const { resolveMediaUrl } = useFormat();

const uploading = ref(false);
const error = ref('');
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const canAddMore = computed(() => props.modelValue.length < props.maxImages);

async function handleFiles(files: FileList | File[] | null) {
  if (!files?.length || uploading.value || !canAddMore.value) return;

  error.value = '';
  uploading.value = true;

  try {
    const next = [...props.modelValue];
    for (const file of Array.from(files)) {
      if (next.length >= props.maxImages) break;
      const { data } = await api.upload<{ url: string }>(props.uploadEndpoint, file);
      next.push(data.url);
    }
    emit('update:modelValue', next);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'خطا در آپلود فایل';
  } finally {
    uploading.value = false;
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  handleFiles(input.files);
  input.value = '';
}

function onDrop(event: DragEvent) {
  dragOver.value = false;
  handleFiles(event.dataTransfer?.files ?? null);
}

function openPicker() {
  if (uploading.value || !canAddMore.value) return;
  fileInput.value?.click();
}

function removeImage(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index)
  );
}

function moveImage(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= props.modelValue.length) return;
  const next = [...props.modelValue];
  [next[index], next[target]] = [next[target], next[index]];
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <label class="text-sm font-medium text-gray-700">{{ label }}</label>
      <span class="text-xs text-gray-400">{{ modelValue.length }} / {{ maxImages }}</span>
    </div>

    <div v-if="modelValue.length" class="grid grid-cols-2 gap-3">
      <div
        v-for="(image, index) in modelValue"
        :key="`${image}-${index}`"
        class="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 aspect-square"
      >
        <img :src="resolveMediaUrl(image)" :alt="`${label} ${index + 1}`" class="w-full h-full object-contain" />
        <div class="absolute top-2 start-2">
          <span
            v-if="index === 0"
            class="text-[10px] font-medium bg-primary-600 text-white px-2 py-0.5 rounded-full"
          >
            اصلی
          </span>
        </div>
        <div class="absolute inset-x-0 bottom-0 flex gap-1 p-2 bg-gradient-to-t from-black/55 to-transparent">
          <button
            type="button"
            class="p-1.5 rounded-lg bg-white/95 text-gray-700 disabled:opacity-40"
            :disabled="index === 0 || uploading"
            @click="moveImage(index, -1)"
          >
            <AppIcon name="lucide:chevron-right" size="sm" />
          </button>
          <button
            type="button"
            class="p-1.5 rounded-lg bg-white/95 text-gray-700 disabled:opacity-40"
            :disabled="index === modelValue.length - 1 || uploading"
            @click="moveImage(index, 1)"
          >
            <AppIcon name="lucide:chevron-left" size="sm" />
          </button>
          <button
            type="button"
            class="p-1.5 rounded-lg bg-white/95 text-red-600 ms-auto"
            :disabled="uploading"
            @click="removeImage(index)"
          >
            <AppIcon name="lucide:trash-2" size="sm" />
          </button>
        </div>
      </div>
    </div>

    <button
      v-if="canAddMore"
      type="button"
      :class="[
        'w-full rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-2 p-5',
        dragOver
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50',
        uploading ? 'opacity-70 cursor-wait' : 'cursor-pointer',
      ]"
      :disabled="uploading"
      @click="openPicker"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
        <AppIcon
          :name="uploading ? 'lucide:loader-2' : 'lucide:images'"
          size="md"
          :class="uploading ? 'text-primary-600 animate-spin' : 'text-gray-400'"
        />
      </div>
      <div class="text-center">
        <p class="text-sm font-medium text-gray-700">
          {{ uploading ? 'در حال آپلود...' : 'افزودن تصویر' }}
        </p>
        <p class="text-xs text-gray-500 mt-1">{{ hint }}</p>
      </div>
    </button>

    <input
      ref="fileInput"
      type="file"
      class="sr-only"
      :accept="accept"
      multiple
      @change="onFileChange"
    />

    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
