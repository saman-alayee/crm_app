<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });

const config = useRuntimeConfig();
const authStore = useAuthStore();
const toast = useToast();
const { isFullAdmin } = useAdminAccess();

const downloading = ref(false);
const lastFilename = ref('');

onMounted(() => {
  if (!isFullAdmin.value) {
    void navigateTo('/admin');
  }
});

async function downloadBackup() {
  if (!isFullAdmin.value) {
    toast.error('فقط ادمین اصلی به بکاپ دسترسی دارد');
    return;
  }
  if (downloading.value) return;

  downloading.value = true;
  try {
    const apiBase = config.public.apiBase.trim().replace(/\/$/, '');
    const response = await fetch(`${apiBase}/admin/backup/database`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });

    if (!response.ok) {
      let message = 'خطا در تهیه بکاپ';
      try {
        const data = await response.json();
        message = data.message || message;
      } catch {
        // ignore non-JSON error bodies
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const headerName = response.headers.get('X-Backup-Filename');
    const disposition = response.headers.get('Content-Disposition') || '';
    const matched = disposition.match(/filename="?([^"]+)"?/i);
    const filename =
      headerName || matched?.[1] || `database-backup-${Date.now()}.sql.gz`;

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
    toast.error(e instanceof Error ? e.message : 'خطا در بکاپ دیتابیس');
  } finally {
    downloading.value = false;
  }
}

useHead({ title: 'بکاپ دیتابیس - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-xl font-bold text-gray-800">بکاپ دیتابیس</h1>
      <p class="text-sm text-gray-500 mt-1 max-w-2xl">
        ادمین اصلی می‌تواند یک نسخهٔ فشرده (`.sql.gz`) از دیتابیس اصلی سایت بگیرد و دانلود کند.
      </p>
    </div>

    <section class="card p-5 max-w-xl space-y-4">
      <div class="flex items-start gap-3">
        <div class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
          <AppIcon name="lucide:database" size="md" />
        </div>
        <div>
          <h2 class="font-bold text-gray-800">پشتیبان‌گیری کامل</h2>
          <p class="text-sm text-gray-500 mt-1 leading-relaxed">
            فایل شامل جداول، داده‌ها، روتین و تریگرهاست و با gzip فشرده می‌شود.
            این عملیات فقط برای نقش «مدیر» فعال است.
          </p>
        </div>
      </div>

      <ul class="text-xs text-gray-500 space-y-1.5 list-disc pe-5">
        <li>قبل از تغییرات مهم یا آپدیت، یک بکاپ بگیرید.</li>
        <li>فایل را در جای امن نگهداری کنید؛ شامل اطلاعات مشتریان و سفارش‌هاست.</li>
        <li>اگر mysqldump روی سرور نصب نباشد، بکاپ ناموفق می‌شود.</li>
      </ul>

      <button
        type="button"
        class="btn-primary text-sm py-2.5 w-full sm:w-auto"
        :disabled="downloading || !isFullAdmin"
        @click="downloadBackup"
      >
        {{ downloading ? 'در حال تهیه بکاپ...' : 'دانلود بکاپ فشرده' }}
      </button>

      <p v-if="lastFilename" class="text-xs text-gray-400 break-all">
        آخرین فایل: {{ lastFilename }}
      </p>
    </section>
  </div>
</template>
