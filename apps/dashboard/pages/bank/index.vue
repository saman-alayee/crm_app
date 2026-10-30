<script setup lang="ts">
import { rules } from '~/composables/useFormValidation';

const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber, formatShortDate } = useFormat();
const { errors, clearField, validate } = useFormValidation();

const mine = ref<any>(null);
const all = ref<any[]>([]);
const loading = ref(true);
const listLoading = ref(false);
const search = ref('');
const tab = ref<'mine' | 'all'>('mine');
const form = reactive({ accountHolder: '', accountNumber: '', iban: '', bankName: '' });

const canListAll = computed(() => auth.can('bank.view'));

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return all.value;
  return all.value.filter((row) => {
    const name = `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`.toLowerCase();
    const hay = [
      name,
      row.bankName,
      row.accountHolder,
      row.iban,
      row.accountNumber || '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
});

async function loadMine() {
  const me = await api<{ success: boolean; data: any }>('/bank-accounts/me');
  mine.value = me.data;
  if (me.data) {
    Object.assign(form, {
      accountHolder: me.data.accountHolder,
      accountNumber: me.data.accountNumber || '',
      iban: me.data.iban,
      bankName: me.data.bankName,
    });
  }
}

async function loadAll() {
  if (!canListAll.value) {
    all.value = [];
    return;
  }
  listLoading.value = true;
  try {
    const list = await api<{ success: boolean; data: any[] }>('/bank-accounts');
    all.value = list.data || [];
  } finally {
    listLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    await loadMine();
    await loadAll();
    if (canListAll.value) tab.value = 'all';
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function save() {
  const iban = form.iban.trim().replace(/\s/g, '').toUpperCase();
  if (
    !validate(
      { ...form, iban },
      {
        accountHolder: [rules.required('نام صاحب حساب الزامی است'), rules.minLength(3)],
        bankName: [rules.required('نام بانک الزامی است')],
        iban: [rules.required('شبا الزامی است'), rules.iban()],
      },
    )
  ) {
    toast.error('لطفاً خطاهای فرم را برطرف کنید');
    return;
  }
  try {
    await api('/bank-accounts/me', {
      method: 'PUT',
      body: { ...form, iban, accountHolder: form.accountHolder.trim(), bankName: form.bankName.trim() },
    });
    toast.success('ذخیره شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function copyText(text: string, label = 'کپی شد') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('کپی نشد');
  }
}

function employeeName(row: any) {
  const n = `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`.trim();
  return n || '—';
}

watch(tab, (v) => {
  if (v === 'all' && !all.value.length && canListAll.value) loadAll();
});

onMounted(load);
useHead({ title: 'حساب بانکی' });
</script>

<template>
  <div>
    <AppPageNav />
    <UiPageHeader
      eyebrow="مالی"
      title="اطلاعات بانکی"
      subtitle="حساب خود را ثبت کنید؛ همه حساب‌های ذخیره‌شده را در همین صفحه ببینید"
    />

    <UiHelpBanner
      storage-key="bank"
      title="راهنمای حساب بانکی"
      :steps="[
        'شماره شبا را با IR و بدون فاصله وارد کنید.',
        'نام صاحب حساب باید دقیقاً مطابق کارت بانکی باشد.',
        'از تب «همه ذخیره‌شده‌ها» لیست کامل حساب کارکنان را ببینید و جست‌وجو کنید.',
      ]"
    />

    <div v-if="canListAll" class="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        class="filter-chip"
        :class="{ 'is-active': tab === 'mine' }"
        @click="tab = 'mine'"
      >
        <AppIcon name="lucide:wallet" size="sm" />
        حساب من
      </button>
      <button
        type="button"
        class="filter-chip"
        :class="{ 'is-active': tab === 'all' }"
        @click="tab = 'all'"
      >
        <AppIcon name="lucide:landmark" size="sm" />
        همه ذخیره‌شده‌ها
        <span v-if="all.length" class="ms-1 opacity-80">({{ formatNumber(all.length) }})</span>
      </button>
    </div>

    <div v-if="loading" class="empty-state empty-state--plain">
      <p class="empty-state__message">در حال بارگذاری…</p>
    </div>

    <template v-else>
      <div v-show="tab === 'mine' || !canListAll">
        <div v-if="auth.can('bank.edit')" class="card mb-6 p-4">
          <h2 class="mb-1 font-semibold">حساب من</h2>
          <p class="mb-3 text-xs" style="color: var(--hr-muted)">این اطلاعات برای پرداخت حقوق و مساعده استفاده می‌شود.</p>
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <label class="field-label">صاحب حساب</label>
              <input
                v-model="form.accountHolder"
                class="input-field"
                :class="{ 'input-invalid': errors.accountHolder }"
                placeholder="نام روی کارت"
                @input="clearField('accountHolder')"
              />
              <UiFieldError :message="errors.accountHolder" />
            </div>
            <div>
              <label class="field-label">بانک</label>
              <input
                v-model="form.bankName"
                class="input-field"
                :class="{ 'input-invalid': errors.bankName }"
                placeholder="مثال: ملت"
                @input="clearField('bankName')"
              />
              <UiFieldError :message="errors.bankName" />
            </div>
            <div>
              <label class="field-label">شبا</label>
              <input
                v-model="form.iban"
                class="input-field"
                :class="{ 'input-invalid': errors.iban }"
                dir="ltr"
                placeholder="IRxxxxxxxxxxxxxxxxxxxxxx"
                @input="clearField('iban')"
              />
              <UiFieldError :message="errors.iban" />
              <UiFieldHint text="۲۴ رقم بعد از IR — بدون فاصله و خط تیره." />
            </div>
            <div>
              <label class="field-label">شماره حساب</label>
              <input v-model="form.accountNumber" class="input-field" dir="ltr" placeholder="اختیاری" />
            </div>
          </div>
          <button class="btn-primary mt-4" type="button" @click="save">ذخیره حساب</button>
        </div>

        <div v-else-if="mine" class="card mb-6 p-4">
          <h2 class="mb-3 font-semibold">حساب من</h2>
          <dl class="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt class="field-label">صاحب حساب</dt>
              <dd>{{ mine.accountHolder }}</dd>
            </div>
            <div>
              <dt class="field-label">بانک</dt>
              <dd>{{ mine.bankName }}</dd>
            </div>
            <div>
              <dt class="field-label">شبا</dt>
              <dd class="cell-mono" dir="ltr">{{ mine.iban }}</dd>
            </div>
            <div v-if="mine.accountNumber">
              <dt class="field-label">شماره حساب</dt>
              <dd class="cell-mono" dir="ltr">{{ mine.accountNumber }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div v-if="canListAll && tab === 'all'">
        <UiCard class="mb-4" padding="md">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">همه حساب‌های ذخیره‌شده</h2>
              <p class="mt-0.5 text-xs" style="color: var(--hr-muted)">
                {{ formatNumber(filtered.length) }} از {{ formatNumber(all.length) }} حساب
              </p>
            </div>
            <button class="btn-soft" type="button" :disabled="listLoading" @click="loadAll">
              <AppIcon name="lucide:refresh-cw" size="sm" />
              به‌روزرسانی
            </button>
          </div>

          <div class="mt-3 search-field">
            <AppIcon name="lucide:search" size="sm" class="search-field__icon" />
            <input
              v-model="search"
              class="input-field"
              placeholder="جست‌وجو: نام کارمند، بانک، صاحب حساب، شبا…"
            />
          </div>
        </UiCard>

        <div v-if="listLoading" class="empty-state empty-state--plain">
          <p class="empty-state__message">در حال بارگذاری لیست…</p>
        </div>

        <div v-else-if="!filtered.length" class="empty-state">
          <AppIcon name="lucide:landmark" class="empty-state__icon" />
          <p class="empty-state__title">{{ search.trim() ? 'نتیجه‌ای پیدا نشد' : 'حسابی ذخیره نشده' }}</p>
          <p class="empty-state__message">
            {{
              search.trim()
                ? 'عبارت جست‌وجو را عوض کنید یا پاک کنید.'
                : 'وقتی کارکنان حساب بانکی‌شان را ذخیره کنند اینجا دیده می‌شود.'
            }}
          </p>
        </div>

        <div v-else class="data-table-wrap hidden md:block">
          <div class="overflow-x-auto">
            <table class="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>کارمند</th>
                  <th>بانک</th>
                  <th>شبا</th>
                  <th>صاحب حساب</th>
                  <th>شماره حساب</th>
                  <th>آخرین ویرایش</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in filtered" :key="row.id">
                  <td class="font-medium">{{ employeeName(row) }}</td>
                  <td>{{ row.bankName }}</td>
                  <td class="cell-mono cell-muted" dir="ltr">{{ row.iban }}</td>
                  <td>{{ row.accountHolder }}</td>
                  <td class="cell-mono cell-muted" dir="ltr">{{ row.accountNumber || '—' }}</td>
                  <td class="cell-muted whitespace-nowrap">
                    {{ row.updatedAt ? formatShortDate(row.updatedAt) : '—' }}
                  </td>
                  <td class="whitespace-nowrap">
                    <button
                      v-if="auth.can('bank.view_sensitive')"
                      class="btn-ghost"
                      type="button"
                      title="کپی شبا"
                      @click="copyText(row.iban, 'شبا کپی شد')"
                    >
                      <AppIcon name="lucide:copy" size="sm" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile-friendly cards -->
        <div class="mt-4 grid gap-3 md:hidden">
          <article v-for="row in filtered" :key="`m-${row.id}`" class="card p-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold">{{ employeeName(row) }}</h3>
                <p class="text-xs" style="color: var(--hr-muted)">{{ row.bankName }} · {{ row.accountHolder }}</p>
              </div>
              <button
                v-if="auth.can('bank.view_sensitive')"
                class="btn-ghost"
                type="button"
                @click="copyText(row.iban, 'شبا کپی شد')"
              >
                <AppIcon name="lucide:copy" size="sm" />
              </button>
            </div>
            <p class="mt-2 cell-mono text-sm" dir="ltr" style="color: var(--hr-muted)">{{ row.iban }}</p>
            <p v-if="row.updatedAt" class="mt-1 text-xs" style="color: var(--hr-muted)">
              ویرایش: {{ formatShortDate(row.updatedAt) }}
            </p>
          </article>
        </div>
      </div>
    </template>
  </div>
</template>
