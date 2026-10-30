<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    uploadEndpoint: string;
    label?: string;
    hint?: string;
    previewClass?: string;
    accept?: string;
  }>(),
  {
    label: 'تصویر',
    hint: 'اختیاری — JPEG, PNG, WebP یا GIF (حداکثر ۵ مگابایت)',
    previewClass: 'w-full aspect-square max-h-44',
    accept: 'image/jpeg,image/png,image/webp,image/gif',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const api = useApi();
const { resolveMediaUrl } = useFormat();

const uploading = ref(false);
const error = ref('');
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const previewUrl = computed(() =>
  props.modelValue ? resolveMediaUrl(props.modelValue) : null
);

async function handleFile(file: File | null) {
  if (!file || uploading.value) return;

  error.value = '';
  uploading.value = true;

  try {
    const { data } = await api.upload<{ url: string }>(props.uploadEndpoint, file);
    emit('update:modelValue', data.url);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'خطا در آپلود فایل';
  } finally {
    uploading.value = false;
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  handleFile(input.files?.[0] ?? null);
  input.value = '';
}

function onDrop(event: DragEvent) {
  dragOver.value = false;
  handleFile(event.dataTransfer?.files?.[0] ?? null);
}

function openPicker() {
  if (uploading.value) return;
  fileInput.value?.click();
}

function removeImage() {
  emit('update:modelValue', null);
  error.value = '';
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <label class="text-sm font-medium text-gray-700">{{ label }}</label>
      <span class="text-xs text-gray-400">اختیاری</span>
    </div>

    <div
      v-if="previewUrl"
      class="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50"
      :class="previewClass"
    >
      <img :src="previewUrl" :alt="label" class="w-full h-full object-contain" />
      <div class="absolute inset-x-0 bottom-0 flex gap-2 p-2 bg-gradient-to-t from-black/50 to-transparent">
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-xs font-medium text-gray-700 hover:bg-white transition-colors"
          :disabled="uploading"
          @click="openPicker"
        >
          <AppIcon name="lucide:upload" size="sm" />
          تغییر
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-xs font-medium text-red-600 hover:bg-white transition-colors"
          :disabled="uploading"
          @click="removeImage"
        >
          <AppIcon name="lucide:trash-2" size="sm" />
          حذف
        </button>
      </div>
      <div
        v-if="uploading"
        class="absolute inset-0 bg-white/70 flex items-center justify-center"
      >
        <AppIcon name="lucide:loader-2" size="lg" class="text-primary-600 animate-spin" />
      </div>
    </div>

    <button
      v-else
      type="button"
      :class="[
        'w-full rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-2 p-6',
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
      <div class="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
        <AppIcon
          :name="uploading ? 'lucide:loader-2' : 'lucide:image-plus'"
          size="md"
          :class="uploading ? 'text-primary-600 animate-spin' : 'text-gray-400'"
        />
      </div>
      <div class="text-center">
        <p class="text-sm font-medium text-gray-700">
          {{ uploading ? 'در حال آپلود...' : 'انتخاب یا رها کردن تصویر' }}
        </p>
        <p class="text-xs text-gray-500 mt-1">{{ hint }}</p>
      </div>
    </button>

    <input
      ref="fileInput"
      type="file"
      class="sr-only"
      :accept="accept"
      @change="onFileChange"
    />

    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
