<script setup lang="ts">
import { rules } from '~/composables/useFormValidation';

const { api } = useApi();
const auth = useAuthStore();
const toast = useToast();
const { errors, clearField, validate } = useFormValidation();
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

    <div v-if="all.length" class="data-table-wrap">
      <div class="overflow-x-auto">
        <table class="data-table min-w-[560px]">
          <thead>
            <tr>
              <th>کارمند</th>
              <th>بانک</th>
              <th>شبا</th>
              <th>صاحب حساب</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in all" :key="row.id">
              <td>{{ row.employee?.firstName }} {{ row.employee?.lastName }}</td>
              <td>{{ row.bankName }}</td>
              <td class="cell-mono cell-muted" dir="ltr">{{ row.iban }}</td>
              <td>{{ row.accountHolder }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
