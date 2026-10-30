<script setup lang="ts">
const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const mine = ref<any>(null);
const all = ref<any[]>([]);
const form = reactive({ accountHolder: '', accountNumber: '', iban: '', bankName: '' });

async function load() {
  try {
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
    if (auth.can('bank.view') && (auth.can('bank.view_sensitive') || auth.can('employees.view'))) {
      const list = await api<{ success: boolean; data: any[] }>('/bank-accounts');
      all.value = list.data;
    }
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function save() {
  try {
    await api('/bank-accounts/me', { method: 'PUT', body: { ...form } });
    toast.success('ذخیره شد');
    await load();
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

onMounted(load);
useHead({ title: 'حساب بانکی' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="مالی"
      title="اطلاعات بانکی"
      subtitle="حساب خود را ثبت کنید تا واریزی‌ها درست انجام شود"
    />

    <UiHelpBanner
      storage-key="bank"
      title="راهنمای حساب بانکی"
      :steps="[
        'شماره شبا را با IR و بدون فاصله وارد کنید.',
        'نام صاحب حساب باید دقیقاً مطابق کارت بانکی باشد.',
        'مدیران می‌توانند لیست حساب همه کارکنان را پایین صفحه ببینند.',
      ]"
    />

    <div v-if="auth.can('bank.edit')" class="card mb-6 p-4">
      <h2 class="mb-1 font-semibold">حساب من</h2>
      <p class="mb-3 text-xs" style="color: var(--hr-muted)">این اطلاعات برای پرداخت حقوق و مساعده استفاده می‌شود.</p>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">صاحب حساب</label>
          <input v-model="form.accountHolder" class="input-field" placeholder="نام روی کارت" />
        </div>
        <div>
          <label class="field-label">بانک</label>
          <input v-model="form.bankName" class="input-field" placeholder="مثال: ملت" />
        </div>
        <div>
          <label class="field-label">شبا</label>
          <input v-model="form.iban" class="input-field" dir="ltr" placeholder="IRxxxxxxxxxxxxxxxxxxxxxx" />
          <UiFieldHint text="۲۴ رقم بعد از IR — بدون فاصله و خط تیره." />
        </div>
        <div>
          <label class="field-label">شماره حساب</label>
          <input v-model="form.accountNumber" class="input-field" dir="ltr" placeholder="اختیاری" />
        </div>
      </div>
      <button class="btn-primary mt-4" type="button" @click="save">ذخیره حساب</button>
    </div>

    <div v-if="all.length" class="card overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-gray-500">
          <tr>
            <th class="px-4 py-3 text-start">کارمند</th>
            <th class="px-4 py-3 text-start">بانک</th>
            <th class="px-4 py-3 text-start">شبا</th>
            <th class="px-4 py-3 text-start">صاحب حساب</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in all" :key="row.id" class="border-t">
            <td class="px-4 py-3">{{ row.employee?.firstName }} {{ row.employee?.lastName }}</td>
            <td class="px-4 py-3">{{ row.bankName }}</td>
            <td class="px-4 py-3" dir="ltr">{{ row.iban }}</td>
            <td class="px-4 py-3">{{ row.accountHolder }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
