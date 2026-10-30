<script setup lang="ts">
const config = useRuntimeConfig();
const auth = useAuthStore();
const toast = useToast();
const downloading = ref(false);
const lastFilename = ref('');

onMounted(() => {
  if (!auth.can('backup.export')) {
    void navigateTo('/');
  }
});

async function downloadBackup() {
  if (downloading.value) return;
  downloading.value = true;
  try {
    const apiBase = resolveApiBase(String(config.public.apiBase || ''));
    const response = await fetch(`${apiBase}/backup/database`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      let message = 'خطا در تهیه بکاپ';
      try {
        const data = await response.json();
        message = data.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const headerName = response.headers.get('X-Backup-Filename');
    const filename = headerName || `hr-backup-${Date.now()}.db.gz`;
    lastFilename.value = filename;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('بکاپ آماده شد و دانلود آغاز شد');
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا در بکاپ');
  } finally {
    downloading.value = false;
  }
}

useHead({ title: 'بکاپ دیتابیس' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="نگهداری"
      title="بکاپ دیتابیس"
      subtitle="نسخه پشتیبان بگیرید تا اطلاعات از دست نرود"
    />

    <UiHelpBanner
      storage-key="backup"
      tone="warn"
      title="قبل از تغییرات مهم بکاپ بگیرید"
      :steps="[
        'دکمه دانلود را بزنید تا فایل فشرده ذخیره شود.',
        'فایل را در جای امن (هارد خارجی یا فضای ابری) نگه دارید.',
        'فقط مدیران با مجوز بکاپ به این صفحه دسترسی دارند.',
      ]"
    />

    <section class="card max-w-xl space-y-4 p-5">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
          <AppIcon name="lucide:database" size="md" />
        </div>
        <div>
          <h2 class="font-bold">پشتیبان‌گیری کامل</h2>
          <p class="mt-1 text-sm leading-relaxed" style="color: var(--hr-muted)">
            فایل `.db.gz` از دیتابیس فعلی ساخته می‌شود. پیشنهاد: هفتگی یا قبل از هر تغییر بزرگ.
          </p>
        </div>
      </div>
      <ul class="list-disc space-y-1.5 pe-5 text-xs" style="color: var(--hr-muted)">
        <li>دانلود ممکن است چند ثانیه طول بکشد — صفحه را نبندید.</li>
        <li>فایل را با دیگران به اشتراک نگذارید؛ اطلاعات حساس دارد.</li>
      </ul>
      <button class="btn-primary" type="button" :disabled="downloading" @click="downloadBackup">
        <AppIcon v-if="downloading" name="lucide:loader-2" size="sm" class="animate-spin" />
        <AppIcon v-else name="lucide:download" size="sm" />
        {{ downloading ? 'در حال آماده‌سازی...' : 'دانلود بکاپ' }}
      </button>
      <p v-if="lastFilename" class="text-xs" style="color: var(--hr-muted)">آخرین فایل: {{ lastFilename }}</p>
    </section>
  </div>
</template>
