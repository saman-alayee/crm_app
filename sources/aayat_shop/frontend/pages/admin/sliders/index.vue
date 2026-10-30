<script setup lang="ts">
import type { Category, Slider } from '~/types';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const toast = useToast();
const authStore = useAuthStore();
const { can } = useAdminAccess();
const { resolveMediaUrl } = useFormat();

const sliders = ref<Slider[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);
const uploading = ref(false);

const form = reactive({
  title: '',
  image: '',
  mobileImage: '',
  linkUrl: '',
  sortOrder: 0,
  placement: 'HOME_TOP' as 'HOME_TOP' | 'HOME_MID',
  categoryId: '' as string,
  isActive: true,
});

const search = ref('');
const placementFilter = ref('');

const categoryOptions = computed(() =>
  categories.value.map((cat) => ({
    value: cat.id,
    label: cat.name,
    icon: 'lucide:folder',
  }))
);

const filteredSliders = computed(() =>
  sliders.value.filter((slider) => {
    if (placementFilter.value && slider.placement !== placementFilter.value) return false;
    if (!search.value.trim()) return true;
    const term = search.value.trim();
    return (
      (slider.title || '').includes(term) ||
      (slider.linkUrl || '').includes(term) ||
      (slider.category?.name || '').includes(term)
    );
  })
);

const sizeHint = computed(() =>
  form.placement === 'HOME_TOP'
    ? 'دسکتاپ ۲۵۶۰×۹۳۶ و گوشی ۱۰۸۰×۱۳۵۰. دو فایل جدا آپلود کنید.'
    : 'سایز پیشنهادی بنر میانی: ۱۶۰۰ × ۵۶۰ پیکسل (نسبت حدود ۱۶ به ۷)'
);

const placementLabel = (slider: Slider) => {
  if (slider.placement === 'HOME_TOP') return 'بالای صفحه';
  return slider.category?.name ? `بعد از «${slider.category.name}»` : 'میان دسته‌ها (بدون دسته)';
};

const loadError = ref('');

onMounted(async () => {
  await authStore.fetchProfile().catch(() => undefined);
  await Promise.all([loadSliders(), loadCategories()]);
});

async function loadCategories() {
  try {
    const { data } = await api.get<Category[]>('/admin/categories');
    categories.value = data.filter((c) => c.isActive !== false);
  } catch {
    categories.value = [];
  }
}

async function loadSliders() {
  loading.value = true;
  loadError.value = '';
  try {
    if (!can('sliders')) {
      loadError.value = 'سطح دسترسی شما برای مشاهده اسلایدرها کافی نیست. از مدیر بخواهید دسترسی «اسلایدر» را فعال کند.';
      sliders.value = [];
      return;
    }
    const res = await api.get<Slider[]>('/admin/sliders');
    sliders.value = Array.isArray(res.data) ? res.data : [];
  } catch (e: unknown) {
    sliders.value = [];
    loadError.value = e instanceof Error ? e.message : 'خطا در بارگذاری اسلایدرها';
    toast.error(loadError.value);
  } finally {
    loading.value = false;
  }
}

function openForm(slider?: Slider) {
  if (slider) {
    editingId.value = slider.id;
    Object.assign(form, {
      title: slider.title || '',
      image: slider.image,
      mobileImage: slider.mobileImage || '',
      linkUrl: slider.linkUrl || '',
      sortOrder: slider.sortOrder,
      placement: slider.placement,
      categoryId: slider.categoryId || slider.category?.id || '',
      isActive: slider.isActive,
    });
  } else {
    editingId.value = null;
    Object.assign(form, {
      title: '',
      image: '',
      mobileImage: '',
      linkUrl: '',
      sortOrder: sliders.value.length + 1,
      placement: 'HOME_TOP',
      categoryId: '',
      isActive: true,
    });
  }
  showForm.value = true;
}

watch(
  () => form.placement,
  (placement) => {
    if (placement === 'HOME_TOP') form.categoryId = '';
  }
);

async function uploadImage(e: Event, target: 'image' | 'mobileImage' = 'image') {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    toast.error('فقط JPG، PNG، WebP یا GIF مجاز است');
    input.value = '';
    return;
  }
  if (file.size > 1.5 * 1024 * 1024) {
    toast.error('حجم تصویر باید کمتر از ۱٫۵ مگابایت باشد');
    input.value = '';
    return;
  }

  uploading.value = true;
  try {
    const { data } = await api.upload<{ url: string }>('/admin/sliders/upload', file);
    form[target] = data.url;
    toast.success('تصویر آپلود شد');
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'خطا در آپلود');
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

async function save() {
  if (!editingId.value) form.placement = 'HOME_TOP';
  if (form.placement === 'HOME_MID' && !form.categoryId) {
    toast.error('این بنر میانی دیگر در فروشگاه نشان داده نمی‌شود. آن را حذف کنید و بنر بالای صفحه بسازید.');
    return;
  }
  try {
      const payload = {
      ...form,
      mobileImage: form.mobileImage || null,
      linkUrl: form.linkUrl || null,
      categoryId: form.placement === 'HOME_MID' ? form.categoryId : null,
    };
    if (editingId.value) {
      await api.put(`/admin/sliders/${editingId.value}`, payload);
      toast.success('اسلایدر به‌روزرسانی شد');
    } else {
      await api.post('/admin/sliders', payload);
      toast.success('اسلایدر ایجاد شد');
    }
    showForm.value = false;
    await loadSliders();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'خطا');
  }
}

async function remove(id: string) {
  if (!confirm('این اسلایدر حذف شود؟')) return;
  await api.delete(`/admin/sliders/${id}`);
  await loadSliders();
}

useHead({ title: 'اسلایدر - پنل مدیریت' });
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold">اسلایدر صفحه اصلی</h1>
        <p class="text-sm leading-6 text-gray-500 mt-1 max-w-2xl">
          فقط بنر بالای صفحهٔ اول فروشگاه از اینجا عوض می‌شود. بنر غیرفعال روی سایت دیده نمی‌شود.
          <span v-if="!loading && sliders.length" class="text-gray-400"> — {{ sliders.length }} مورد</span>
        </p>
      </div>
      <button class="btn-primary text-sm" @click="openForm()">+ اسلایدر جدید</button>
    </div>

    <div class="card p-4 mb-6 text-sm text-gray-700 leading-7 bg-primary-50/40 border border-primary-100">
      <p class="font-bold text-gray-800 mb-2 flex items-center gap-2">
        <AppIcon name="lucide:circle-help" size="sm" class="text-primary-600" />
        راهنما — بنر بالای فروشگاه
      </p>
      <ul class="list-disc pr-5 space-y-1.5">
        <li>
          دو فایل جدا لازم است. دسکتاپ <b>۲۵۶۰ × ۹۳۶</b> و گوشی <b>۱۰۸۰ × ۱۳۵۰</b>. موضوع اصلی وسط کادر باشد.
        </li>
        <li>
          <b>آپلود تصویر:</b> فرمت JPG یا PNG یا WebP، حجم کمتر از <b>۱٫۵ مگابایت</b>. تصویر را از دکمه «انتخاب
          فایل» بگذارید؛ بعد از آپلود پیش‌نمایش را ببینید و سپس ذخیره کنید.
        </li>
        <li>یک عکس را برای هر دو اندازه نکشید. اگر فقط عکس دسکتاپ باشد، گوشی همان را برش می‌دهد.</li>
        <li>حداکثر <b>۴ اسلاید فعال</b> در هر جایگاه روی سایت نمایش داده می‌شود (بر اساس «ترتیب نمایش»).</li>
        <li>
          لینک اختیاری: مثلاً <span dir="ltr">/categories/woman-clothe</span> — با لمس بنر همان صفحه باز می‌شود.
        </li>
      </ul>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-4">
      <input v-model="search" type="search" class="input-field md:max-w-xs" placeholder="جستجو عنوان، دسته یا لینک..." />
      <AppSelect
        v-model="placementFilter"
        :options="[
          { value: '', label: 'همه بنرها', icon: 'lucide:images' },
          { value: 'HOME_TOP', label: 'بالای صفحه', icon: 'lucide:panel-top' },
        ]"
        class="md:max-w-xs"
      />
    </div>

    <LoadingSpinner :show="loading" />

    <div
      v-if="loadError"
      class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ loadError }}
    </div>

    <div
      v-if="!loading && sliders.length && !filteredSliders.length"
      class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      فیلتر فعال است و هیچ اسلایدری با این شرط پیدا نشد.
      <button type="button" class="underline ms-2" @click="search = ''; placementFilter = ''">پاک کردن فیلتر</button>
    </div>

    <div v-if="!loading" class="grid md:grid-cols-2 gap-4">
      <div v-for="slider in filteredSliders" :key="slider.id" class="card overflow-hidden">
        <img
          :src="resolveMediaUrl(slider.image)"
          :alt="slider.title || ''"
          class="w-full aspect-[16/7] object-cover bg-gray-100"
        />
        <div class="p-4 flex items-center justify-between gap-2">
          <div>
            <p class="font-medium">{{ slider.title || 'بدون عنوان' }}</p>
            <p class="text-xs text-gray-500 mt-1">
              {{ placementLabel(slider) }}
              <span v-if="!slider.isActive" class="text-red-500"> • غیرفعال</span>
            </p>
          </div>
          <div class="admin-actions">
            <button type="button" class="admin-btn-secondary" @click="openForm(slider)">ویرایش</button>
            <button type="button" class="admin-btn-danger" @click="remove(slider.id)">حذف</button>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!loading && !loadError && !filteredSliders.length" message="اسلایدری یافت نشد — با دکمه «+ اسلایدر جدید» بنر بسازید" />

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form class="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" @submit.prevent="save">
        <h2 class="font-bold text-lg">{{ editingId ? 'ویرایش اسلایدر' : 'اسلایدر جدید' }}</h2>

        <input v-model="form.title" required class="input-field" placeholder="عنوان (مثلاً کالکشن پاییز)" />

        <p class="text-xs text-primary-700 bg-primary-50 rounded-lg px-3 py-2">{{ sizeHint }}</p>

        <input v-model="form.linkUrl" class="input-field" placeholder="لینک اختیاری مثل /categories/woman-clothe" dir="ltr" />
        <input v-model.number="form.sortOrder" type="number" class="input-field" placeholder="ترتیب نمایش (عدد کوچک‌تر = زودتر)" />
        <AppSwitch v-model="form.isActive" label="نمایش در سایت" />

        <div class="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
          <label class="block text-sm font-medium">عکس دسکتاپ</label>
          <p class="text-xs text-gray-500 leading-relaxed">افقی، حدود ۲۵۶۰×۹۳۶. JPG/PNG/WebP، حداکثر ۱٫۵MB.</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="text-sm w-full"
            :disabled="uploading"
            @change="uploadImage($event, 'image')"
          />
          <img
            v-if="form.image"
            :src="resolveMediaUrl(form.image)"
            class="w-full aspect-[2560/936] rounded-lg object-cover bg-gray-100 border border-gray-200"
            alt="پیش‌نمایش دسکتاپ"
          />
          <label class="block pt-2 text-sm font-medium">عکس گوشی</label>
          <p class="text-xs text-gray-500 leading-relaxed">عمودی، حدود ۱۰۸۰×۱۳۵۰. اگر خالی بماند، عکس دسکتاپ در گوشی برش می‌خورد.</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="text-sm w-full"
            :disabled="uploading"
            @change="uploadImage($event, 'mobileImage')"
          />
          <img
            v-if="form.mobileImage"
            :src="resolveMediaUrl(form.mobileImage)"
            class="mx-auto w-40 aspect-[4/5] rounded-lg object-cover bg-gray-100 border border-gray-200"
            alt="پیش‌نمایش گوشی"
          />
          <p class="text-xs" :class="uploading ? 'text-primary-600' : 'text-gray-400'">
            {{ uploading ? 'در حال آپلود… لطفاً صبر کنید' : 'هر دو عکس را جدا آپلود کنید، بعد ذخیره بزنید.' }}
          </p>
        </div>

        <div class="flex gap-2">
          <button type="submit" class="btn-primary flex-1" :disabled="!form.image || uploading">ذخیره</button>
          <button type="button" class="btn-secondary flex-1" @click="showForm = false">انصراف</button>
        </div>
      </form>
    </div>
  </div>
</template>
