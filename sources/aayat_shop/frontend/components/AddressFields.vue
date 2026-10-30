<script setup lang="ts">
import type { AddressFieldErrors } from '~/composables/useAddressFields';
import { IRAN_PROVINCES } from '~/constants/iranLocations';
import { normalizeDigits } from '~/utils/normalize';

const props = defineProps<{
  errors?: AddressFieldErrors;
  streetLabel?: string;
  cityOptions?: string[];
}>();

const street = defineModel<string>('street', { default: '' });
const plaque = defineModel<string>('plaque', { default: '' });
const unit = defineModel<string>('unit', { default: '' });
const province = defineModel<string>('province', { default: 'تهران' });
const city = defineModel<string>('city', { default: 'تهران' });
const postalCode = defineModel<string>('postalCode', { default: '' });

const provinceOptions = IRAN_PROVINCES.map((item) => ({ value: item.name, label: item.name }));
const citySelectOptions = computed(() =>
  (props.cityOptions ?? []).map((name) => ({ value: name, label: name }))
);

function onPostalInput(event: Event) {
  const el = event.target as HTMLInputElement;
  postalCode.value = normalizeDigits(el.value).replace(/\D/g, '').slice(0, 10);
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="field-label">استان</label>
        <AppSelect v-model="province" :options="provinceOptions" :invalid="Boolean(errors?.province)" />
        <AppFormError :message="errors?.province" />
      </div>
      <div>
        <label class="field-label">شهر</label>
        <AppSelect v-model="city" :options="citySelectOptions" :invalid="Boolean(errors?.city)" />
        <AppFormError :message="errors?.city" />
      </div>
    </div>

    <div>
      <label class="field-label">{{ streetLabel || 'خیابان و محله' }}</label>
      <textarea
        v-model="street"
        required
        rows="2"
        class="input-field resize-none"
        :class="{ 'input-invalid': errors?.street }"
        placeholder="محله، خیابان"
      />
      <AppFormError :message="errors?.street" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="field-label">پلاک</label>
        <input
          v-model="plaque"
          type="text"
          required
          inputmode="numeric"
          class="input-field"
          :class="{ 'input-invalid': errors?.plaque }"
          placeholder="۱۲"
          dir="ltr"
        />
        <AppFormError :message="errors?.plaque" />
      </div>
      <div>
        <label class="field-label">واحد</label>
        <input
          v-model="unit"
          type="text"
          required
          class="input-field"
          :class="{ 'input-invalid': errors?.unit }"
          placeholder="۳"
          dir="ltr"
        />
        <AppFormError :message="errors?.unit" />
      </div>
    </div>

    <div>
      <label class="field-label">کدپستی</label>
      <input
        :value="postalCode"
        type="text"
        required
        inputmode="numeric"
        maxlength="10"
        class="input-field"
        :class="{ 'input-invalid': errors?.postalCode }"
        placeholder="۱۰ رقم"
        dir="ltr"
        @input="onPostalInput"
      />
      <AppFormError :message="errors?.postalCode" />
      <p v-if="!errors?.postalCode" class="mt-1 text-[11px] text-gray-400">۱۰ رقم، بدون خط تیره. رقم فارسی هم قبول است.</p>
    </div>
  </div>
</template>
