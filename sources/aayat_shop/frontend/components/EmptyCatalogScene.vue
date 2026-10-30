<script setup lang="ts">
export type EmptyCatalogVariant = 'products' | 'search' | 'favorites' | 'cart' | 'stock';

const props = withDefaults(
  defineProps<{
    variant?: EmptyCatalogVariant;
    title?: string;
    description?: string;
    compact?: boolean;
  }>(),
  {
    variant: 'products',
    compact: false,
  },
);

const defaults: Record<
  EmptyCatalogVariant,
  { title: string; description: string; eyebrow: string }
> = {
  products: {
    eyebrow: 'قفسه خالی',
    title: 'چیزی برای نمایش نیست',
    description: 'این بخش فعلاً خالی است. کمی بعد برگردید یا بخش دیگری را ببینید.',
  },
  search: {
    eyebrow: 'بدون نتیجه',
    title: 'چیزی پیدا نشد',
    description: 'عبارت دیگری بنویسید یا فیلترها را تغییر دهید.',
  },
  favorites: {
    eyebrow: 'لیست علاقه',
    title: 'علاقه‌مندی خالی است',
    description: 'با زدن روی قلب، لباس‌های محبوب‌تان اینجا جمع می‌شوند.',
  },
  cart: {
    eyebrow: 'سبد خرید',
    title: 'سبد خالی است',
    description: 'هنوز محصولی اضافه نکرده‌اید. از کالکشن‌ها انتخاب کنید.',
  },
  stock: {
    eyebrow: 'موجودی',
    title: 'فعلاً ناموجود',
    description: 'این گزینه در انبار نیست. سایز یا رنگ دیگری را امتحان کنید.',
  },
};

const copy = computed(() => {
  const base = defaults[props.variant];
  return {
    eyebrow: base.eyebrow,
    title: props.title || base.title,
    description: props.description || base.description,
  };
});

/** ناموجودی محصول و لیست خالی → رگال + جالباسی */
const centerIcon = computed(() => {
  switch (props.variant) {
    case 'cart':
      return 'bag';
    case 'favorites':
      return 'bookmark';
    case 'search':
      return 'lens';
    case 'stock':
    case 'products':
    default:
      return 'rack';
  }
});
</script>

<template>
  <div
    class="void-empty relative overflow-hidden"
    :class="compact ? 'rounded-2xl px-4 py-8' : 'rounded-[1.75rem] px-5 py-12 sm:py-14'"
  >
    <div class="void-empty__bg" aria-hidden="true">
      <span class="void-empty__ring void-empty__ring--a" />
      <span class="void-empty__ring void-empty__ring--b" />
      <span class="void-empty__glow" />
      <span
        v-for="n in 8"
        :key="n"
        class="void-empty__flake"
        :style="{ '--n': n }"
      />
    </div>

    <div class="relative z-10 mx-auto flex max-w-sm flex-col items-center text-center">
      <div class="void-empty__stage relative mb-1" :class="compact ? 'h-28 w-28' : 'h-36 w-36 sm:h-40 sm:w-40'">
        <svg
          class="h-full w-full"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          :aria-label="copy.title"
        >
          <!-- orbiting measure ticks -->
          <circle
            class="void-empty__orbit"
            cx="80"
            cy="80"
            r="62"
            stroke="#6f5644"
            stroke-opacity="0.12"
            stroke-width="1.2"
            stroke-dasharray="2 10"
          />
          <circle
            class="void-empty__orbit void-empty__orbit--rev"
            cx="80"
            cy="80"
            r="50"
            stroke="#b8924a"
            stroke-opacity="0.28"
            stroke-width="1"
            stroke-dasharray="1 8"
          />

          <!-- void hole -->
          <circle cx="80" cy="80" r="34" fill="#6f5644" fill-opacity="0.05" />
          <circle
            class="void-empty__pulse"
            cx="80"
            cy="80"
            r="34"
            stroke="#6f5644"
            stroke-opacity="0.22"
            stroke-width="1.4"
          />

          <!-- رگال + جالباسی خالی -->
          <g v-if="centerIcon === 'rack'" class="void-empty__motif">
            <!-- میله رگال -->
            <line x1="48" y1="58" x2="112" y2="58" stroke="#6f5644" stroke-width="2.4" stroke-linecap="round" />
            <circle cx="48" cy="58" r="2.8" fill="#6f5644" fill-opacity="0.45" />
            <circle cx="112" cy="58" r="2.8" fill="#6f5644" fill-opacity="0.45" />
            <path
              d="M80 58c0-8 10-8 10 1 0 6-5 8-7 11"
              stroke="#6f5644"
              stroke-width="2.2"
              stroke-linecap="round"
              fill="none"
            />
            <path
              d="M83 70 58 96c-3 4 1 8 5 8h40c4 0 8-4 5-8L83 70z"
              fill="none"
              stroke="#6f5644"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <path d="M66 98h28" stroke="#6f5644" stroke-width="1.6" stroke-linecap="round" />
            <!-- جای خالی لباس (نقطه‌چین) -->
            <path
              d="M62 88c5 4 11 6 18 6s13-2 18-6"
              stroke="#6f5644"
              stroke-opacity="0.3"
              stroke-width="1.3"
              stroke-dasharray="3 4"
              class="void-empty__dash"
              fill="none"
            />
          </g>

          <g v-else-if="centerIcon === 'bag'" class="void-empty__motif">
            <path
              d="M58 72h44l-4 36c0 4-3 7-7 7H69c-4 0-7-3-7-7l-4-36z"
              stroke="#6f5644"
              stroke-width="2"
              fill="#6f5644"
              fill-opacity="0.06"
            />
            <path d="M70 72c0-8 4-14 10-14s10 6 10 14" stroke="#6f5644" stroke-width="2" fill="none" />
            <path
              d="M68 88h24"
              stroke="#b8924a"
              stroke-width="1.4"
              stroke-dasharray="3 3"
              class="void-empty__dash"
            />
          </g>

          <g v-else-if="centerIcon === 'bookmark'" class="void-empty__motif">
            <path
              d="M64 52h32c3 0 6 3 6 6v52l-16-10-16 10V58c0-3 3-6 6-6z"
              stroke="#6f5644"
              stroke-width="2"
              fill="#6f5644"
              fill-opacity="0.07"
              stroke-dasharray="4 5"
              class="void-empty__dash"
            />
          </g>

          <g v-else-if="centerIcon === 'lens'" class="void-empty__motif">
            <circle cx="74" cy="74" r="16" stroke="#6f5644" stroke-width="2.2" fill="#6f5644" fill-opacity="0.05" />
            <line x1="86" y1="86" x2="102" y2="102" stroke="#6f5644" stroke-width="2.4" stroke-linecap="round" />
            <circle
              cx="74"
              cy="74"
              r="8"
              stroke="#b8924a"
              stroke-width="1.2"
              stroke-dasharray="2 3"
              class="void-empty__dash"
              fill="none"
            />
          </g>


          <!-- floating size chips -->
          <g class="void-empty__chip void-empty__chip--a">
            <rect x="18" y="40" width="22" height="16" rx="3" fill="#fff" stroke="#6f5644" stroke-opacity="0.25" />
            <text x="29" y="51" text-anchor="middle" fill="#6f5644" font-size="8" font-family="Tahoma, sans-serif">S</text>
          </g>
          <g class="void-empty__chip void-empty__chip--b">
            <rect x="122" y="48" width="22" height="16" rx="3" fill="#fff" stroke="#b8924a" stroke-opacity="0.4" />
            <text x="133" y="59" text-anchor="middle" fill="#9a7838" font-size="8" font-family="Tahoma, sans-serif">M</text>
          </g>
          <g class="void-empty__chip void-empty__chip--c">
            <rect x="112" y="112" width="22" height="16" rx="3" fill="#fff" stroke="#6f5644" stroke-opacity="0.25" />
            <text x="123" y="123" text-anchor="middle" fill="#6f5644" font-size="8" font-family="Tahoma, sans-serif">L</text>
          </g>
        </svg>
      </div>

      <p class="void-empty__eyebrow text-[11px] font-medium tracking-wide text-primary-800/70">
        {{ copy.eyebrow }}
      </p>
      <h2
        class="void-empty__title mt-2 font-semibold tracking-tight text-neutral-950"
        :class="compact ? 'text-base' : 'text-lg sm:text-xl'"
      >
        {{ copy.title }}
      </h2>
      <p class="void-empty__copy mt-2 max-w-xs text-sm leading-7 text-neutral-500">
        {{ copy.description }}
      </p>

      <div class="void-empty__actions mt-5 flex flex-wrap items-center justify-center gap-3">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.void-empty {
  background:
    radial-gradient(circle at 50% 28%, rgba(101, 42, 59, 0.08), transparent 42%),
    linear-gradient(180deg, #fffdfa 0%, #f5eef1 100%);
  border: 1px solid rgba(101, 42, 59, 0.06);
}

.void-empty__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.void-empty__glow {
  position: absolute;
  inset: 20% 25%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(184, 146, 74, 0.12), transparent 70%);
  animation: void-breathe 4.5s ease-in-out infinite;
}

.void-empty__ring {
  position: absolute;
  left: 50%;
  top: 38%;
  border: 1px solid rgba(101, 42, 59, 0.08);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.void-empty__ring--a {
  width: 11rem;
  height: 11rem;
  animation: void-spin 28s linear infinite;
}

.void-empty__ring--b {
  width: 15rem;
  height: 15rem;
  border-style: dashed;
  animation: void-spin 40s linear infinite reverse;
}

.void-empty__flake {
  position: absolute;
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 999px;
  background: rgba(101, 42, 59, 0.18);
  top: calc(8% + var(--n) * 10%);
  left: calc(6% + var(--n) * 11%);
  animation: void-drift 5s ease-in-out infinite;
  animation-delay: calc(var(--n) * -0.4s);
}

.void-empty__flake:nth-child(odd) {
  background: rgba(184, 146, 74, 0.35);
  border-radius: 1px;
}

.void-empty__orbit {
  transform-origin: 80px 80px;
  animation: void-spin 18s linear infinite;
}

.void-empty__orbit--rev {
  animation-direction: reverse;
  animation-duration: 12s;
}

.void-empty__pulse {
  transform-origin: 80px 80px;
  animation: void-pulse-ring 2.8s ease-in-out infinite;
}

.void-empty__motif {
  transform-origin: 80px 80px;
  animation: void-float 3.6s ease-in-out infinite;
}

.void-empty__dash {
  animation: void-dash 3s linear infinite;
}

.void-empty__chip {
  transform-box: fill-box;
  transform-origin: center;
}

.void-empty__chip--a {
  animation: void-chip 4s ease-in-out infinite;
}
.void-empty__chip--b {
  animation: void-chip 4.6s ease-in-out infinite reverse;
  animation-delay: -0.6s;
}
.void-empty__chip--c {
  animation: void-chip 5s ease-in-out infinite;
  animation-delay: -1.2s;
}

.void-empty__eyebrow,
.void-empty__title,
.void-empty__copy,
.void-empty__actions {
  animation: void-rise 0.6s ease both;
}
.void-empty__title { animation-delay: 0.06s; }
.void-empty__copy { animation-delay: 0.12s; }
.void-empty__actions { animation-delay: 0.18s; }

@keyframes void-spin {
  to { transform: rotate(360deg); }
}

@keyframes void-pulse-ring {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
}

@keyframes void-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes void-dash {
  to { stroke-dashoffset: -28; }
}

@keyframes void-chip {
  0%, 100% { transform: translateY(0) rotate(-6deg); }
  50% { transform: translateY(-7px) rotate(6deg); }
}

@keyframes void-breathe {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

@keyframes void-drift {
  0%, 100% { transform: translateY(0); opacity: 0.35; }
  50% { transform: translateY(-8px); opacity: 0.9; }
}

@keyframes void-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .void-empty__glow,
  .void-empty__ring,
  .void-empty__flake,
  .void-empty__orbit,
  .void-empty__pulse,
  .void-empty__motif,
  .void-empty__dash,
  .void-empty__chip,
  .void-empty__eyebrow,
  .void-empty__title,
  .void-empty__copy,
  .void-empty__actions {
    animation: none !important;
  }
}
</style>
