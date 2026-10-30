<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { formatNumber, formatShortDate } = useFormat();

const loading = ref(true);
const accounts = ref<any[]>([]);
const requests = ref<any[]>([]);
const tab = ref<'accounts' | 'requests'>('accounts');
const showAccount = ref(false);
const accountForm = reactive({
  name: '',
  bankName: '',
  iban: '',
  accountNumber: '',
  dailyCapTotal: '' as number | '',
});
const methodForms = reactive<Record<string, { name: string; dailyCap: number | '' }>>({});
const moneyForm = reactive({
  opsBankAccountId: '',
  paymentMethodId: '',
  amount: '' as number | '',
  purpose: '',
});
const dirty = ref(false);
useDirtyForm(dirty);

async function load() {
  loading.value = true;
  try {
    const [acc, reqs] = await Promise.all([
      api<{ success: boolean; data: any[] }>('/ops-bank'),
      api<{ success: boolean; data: any[] }>('/ops-bank/money-requests'),
    ]);
    accounts.value = acc.data;
    requests.value = reqs.data;
    for (const a of accounts.value) {
      if (!methodForms[a.id]) methodForms[a.id] = { name: '', dailyCap: '' };
    }
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  } finally {
    loading.value = false;
  }
}

async function createAccount() {
  try {
    await api('/ops-bank', {
      method: 'POST',
      body: {
        ...accountForm,
        dailyCapTotal: accountForm.dailyCapTotal === '' ? null : accountForm.dailyCapTotal,
      },
    });
    toast.success('حساب ثبت شد');
    dirty.value = false;
    showAccount.value = false;
    Object.assign(accountForm, { name: '', bankName: '', iban: '', accountNumber: '', dailyCapTotal: '' });
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function addMethod(accountId: string) {
  const f = methodForms[accountId];
  if (!f?.name.trim()) return toast.error('نام روش لازم است');
  try {
    await api(`/ops-bank/${accountId}/methods`, {
      method: 'POST',
      body: { name: f.name.trim(), dailyCap: f.dailyCap === '' ? null : f.dailyCap },
    });
    toast.success('روش ثبت شد');
    f.name = '';
    f.dailyCap = '';
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function saveCaps(account: any) {
  try {
    await api(`/ops-bank/${account.id}`, {
      method: 'PUT',
      body: {
        dailyCapTotal: account._cap === '' || account._cap == null ? null : account._cap,
        manualBalance: account._bal === '' || account._bal == null ? undefined : account._bal,
      },
    });
    toast.success('ذخیره شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function createMoney() {
  try {
    await api('/ops-bank/money-requests', {
      method: 'POST',
      body: {
        ...moneyForm,
        paymentMethodId: moneyForm.paymentMethodId || null,
        amount: moneyForm.amount,
      },
    });
    toast.success('درخواست ثبت شد');
    moneyForm.amount = '';
    moneyForm.purpose = '';
    tab.value = 'requests';
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function decide(id: string, ok: boolean) {
  try {
    if (ok) await api(`/ops-bank/money-requests/${id}/approve`, { method: 'POST' });
    else {
      const reason = window.prompt('دلیل رد؟') || '';
      if (!reason.trim()) return;
      await api(`/ops-bank/money-requests/${id}/reject`, { method: 'POST', body: { reason } });
    }
    toast.success(ok ? 'تأیید شد' : 'رد شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function consumeOrRelease(id: string, action: 'consume' | 'release') {
  try {
    await api(`/ops-bank/money-requests/${id}/${action}`, { method: 'POST' });
    toast.success(action === 'consume' ? 'مصرف شد' : 'آزاد شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

const selectedAccount = computed(() => accounts.value.find((a) => a.id === moneyForm.opsBankAccountId));

onMounted(load);
useHead({ title: 'بانک عملیاتی' });
</script>

<template>
  <div>
    <AppPageNav />
    <UiPageHeader
      eyebrow="فروشگاه"
      title="بانک عملیاتی"
      subtitle="همه حساب‌های ذخیره‌شده، سقف روزانه و رزرو اتمی وجه"
    />

    <div class="mb-4 flex flex-wrap gap-2">
      <button type="button" class="filter-chip" :class="{ 'is-active': tab === 'accounts' }" @click="tab = 'accounts'">
        همه حساب‌ها ({{ formatNumber(accounts.length) }})
      </button>
      <button type="button" class="filter-chip" :class="{ 'is-active': tab === 'requests' }" @click="tab = 'requests'">
        درخواست وجه
      </button>
      <button
        v-if="auth.can('opsbank.create') && tab === 'accounts'"
        class="btn-primary ms-auto"
        type="button"
        @click="showAccount = !showAccount"
      >
        حساب جدید
      </button>
    </div>

    <div v-if="loading" class="empty-state empty-state--plain"><p>در حال بارگذاری…</p></div>

    <template v-else-if="tab === 'accounts'">
      <div v-if="showAccount" class="card mb-4 p-4">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="field-label">نام</label>
            <input v-model="accountForm.name" class="input-field" @input="dirty = true" />
          </div>
          <div>
            <label class="field-label">بانک</label>
            <input v-model="accountForm.bankName" class="input-field" @input="dirty = true" />
          </div>
          <div>
            <label class="field-label">شبا</label>
            <input v-model="accountForm.iban" class="input-field" dir="ltr" @input="dirty = true" />
          </div>
          <div>
            <label class="field-label">سقف روزانه کل</label>
            <input v-model="accountForm.dailyCapTotal" class="input-field" type="number" dir="ltr" @input="dirty = true" />
          </div>
        </div>
        <button class="btn-primary mt-3" type="button" @click="createAccount">ذخیره</button>
      </div>

      <div v-if="!accounts.length" class="empty-state"><p class="empty-state__title">حساب عملیاتی ذخیره نشده</p></div>
      <div v-else class="grid gap-3">
        <article v-for="a in accounts" :key="a.id" class="card p-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="font-semibold">{{ a.name }} <span v-if="!a.isActive" class="text-xs">(غیرفعال)</span></p>
              <p class="text-xs" style="color: var(--hr-muted)">
                {{ a.bankName || '—' }} ·
                <span dir="ltr">{{ a.iban || '—' }}</span>
              </p>
              <p class="mt-1 text-xs" style="color: var(--hr-muted)">
                سقف روزانه:
                {{ a.dailyCapTotal != null ? formatNumber(Number(a.dailyCapTotal)) : 'تنظیم‌نشده' }}
              </p>
              <p v-if="a.manualBalance" class="mt-1 text-xs">
                موجودی دستی:
                <template v-if="a.manualBalance.value">
                  {{ formatNumber(Number(a.manualBalance.value)) }}
                  ·
                  {{ a.manualBalance.fresh ? 'تازه‌' : 'منسوخ' }}
                  <span v-if="!a.manualBalance.definitive" class="opacity-70">(قطعی نمایش داده نمی‌شود)</span>
                </template>
                <template v-else>ماسک‌شده / {{ a.manualBalance.fresh ? 'تازه' : 'منسوخ' }}</template>
              </p>
            </div>
          </div>

          <div v-if="auth.can('opsbank.edit')" class="mt-3 grid gap-2 md:grid-cols-3">
            <input
              v-model="a._cap"
              class="input-field"
              type="number"
              dir="ltr"
              :placeholder="a.dailyCapTotal != null ? String(a.dailyCapTotal) : 'سقف روزانه'"
            />
            <input
              v-if="auth.can('opsbank.view_sensitive')"
              v-model="a._bal"
              class="input-field"
              type="number"
              dir="ltr"
              placeholder="موجودی دستی (اختیاری)"
            />
            <button class="btn-soft" type="button" @click="saveCaps(a)">ذخیره سقف/موجودی</button>
          </div>

          <div class="mt-3">
            <p class="text-sm font-medium">روش‌های پرداخت</p>
            <ul class="mt-1 space-y-1 text-sm">
              <li v-for="m in a.methods" :key="m.id" class="flex justify-between gap-2">
                <span>{{ m.name }} {{ m.isActive ? '' : '(غیرفعال)' }}</span>
                <span style="color: var(--hr-muted)">
                  سقف: {{ m.dailyCap != null ? formatNumber(Number(m.dailyCap)) : '—' }}
                </span>
              </li>
            </ul>
            <div v-if="auth.can('opsbank.create')" class="mt-2 flex flex-wrap gap-2">
              <input v-model="methodForms[a.id].name" class="input-field max-w-[160px]" placeholder="نام روش" />
              <input
                v-model="methodForms[a.id].dailyCap"
                class="input-field max-w-[140px]"
                type="number"
                dir="ltr"
                placeholder="سقف"
              />
              <button class="btn-ghost" type="button" @click="addMethod(a.id)">افزودن روش</button>
            </div>
          </div>
        </article>
      </div>
    </template>

    <template v-else>
      <div v-if="auth.can('opsbank.create')" class="card mb-4 p-4">
        <h2 class="mb-3 font-semibold">درخواست وجه جدید</h2>
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="field-label">حساب</label>
            <select v-model="moneyForm.opsBankAccountId" class="input-field">
              <option value="">انتخاب</option>
              <option v-for="a in accounts.filter((x) => x.isActive)" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">روش</label>
            <select v-model="moneyForm.paymentMethodId" class="input-field">
              <option value="">—</option>
              <option
                v-for="m in selectedAccount?.methods?.filter((x: any) => x.isActive) || []"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="field-label">مبلغ</label>
            <input v-model="moneyForm.amount" class="input-field" type="number" dir="ltr" />
          </div>
          <div>
            <label class="field-label">بابت</label>
            <input v-model="moneyForm.purpose" class="input-field" />
          </div>
        </div>
        <button class="btn-primary mt-3" type="button" @click="createMoney">ثبت درخواست</button>
      </div>

      <div v-if="!requests.length" class="empty-state"><p class="empty-state__title">درخواستی نیست</p></div>
      <div v-else class="grid gap-3">
        <article v-for="r in requests" :key="r.id" class="card p-4">
          <p class="font-semibold">
            {{ formatNumber(Number(r.amount)) }} تومان — {{ r.opsBankAccount?.name }}
            <span class="ms-2 text-xs font-normal">{{ r.status }}</span>
          </p>
          <p class="text-xs" style="color: var(--hr-muted)">
            {{ r.purpose || '—' }} · {{ formatShortDate(r.createdAt) }}
            <span v-if="r.reservation"> · رزرو: {{ r.reservation.status }}</span>
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            <template v-if="r.status === 'PENDING' && auth.can('opsbank.approve')">
              <button class="btn-primary" type="button" @click="decide(r.id, true)">تأیید+رزرو</button>
              <button class="btn-ghost" type="button" @click="decide(r.id, false)">رد</button>
            </template>
            <template v-if="r.reservation?.status === 'RESERVED' && auth.can('opsbank.approve')">
              <button class="btn-soft" type="button" @click="consumeOrRelease(r.id, 'consume')">مصرف</button>
              <button class="btn-ghost" type="button" @click="consumeOrRelease(r.id, 'release')">آزادسازی</button>
            </template>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
