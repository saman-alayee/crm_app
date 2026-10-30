<script setup lang="ts">
withDefaults(
  defineProps<{
    description: string;
    preview?: boolean;
  }>(),
  {
    preview: false,
  },
);

const steps = [
  { label: 'برش', done: true },
  { label: 'دوخت', done: true },
  { label: 'اتو', done: false },
  { label: 'بازگشایی', done: false },
];
</script>

<template>
  <div class="atelier relative min-h-[100dvh] overflow-hidden">
    <div class="atelier-bg" aria-hidden="true">
      <span class="atelier-grid" />
      <span class="atelier-blob atelier-blob-a" />
      <span class="atelier-blob atelier-blob-b" />
      <span class="atelier-blob atelier-blob-c" />
      <span
        v-for="i in 12"
        :key="i"
        class="atelier-confetti"
        :style="{ '--i': i }"
      />
      <span class="atelier-tape atelier-tape-a" />
      <span class="atelier-tape atelier-tape-b" />
    </div>

    <div class="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-5 py-12 text-center">
      <slot name="brand" />

      <div class="atelier-stage relative mb-1 w-full max-w-lg">
        <svg
          class="mx-auto h-auto w-full max-w-[24rem]"
          viewBox="0 0 400 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="مانکن در حال دوخت و تعمیر"
        >
          <!-- rod -->
          <line x1="40" y1="32" x2="360" y2="32" stroke="#6f5644" stroke-opacity="0.2" stroke-width="3" stroke-linecap="round" />
          <circle cx="40" cy="32" r="4.5" fill="#6f5644" fill-opacity="0.35" />
          <circle cx="360" cy="32" r="4.5" fill="#6f5644" fill-opacity="0.35" />

          <!-- mannequin + dress -->
          <g class="atelier-mannequin">
            <line x1="200" y1="32" x2="200" y2="58" stroke="#6f5644" stroke-width="2.5" stroke-linecap="round" />
            <ellipse cx="200" cy="72" rx="16" ry="14" fill="#6f5644" fill-opacity="0.12" stroke="#6f5644" stroke-width="1.6" />
            <path
              d="M168 88c10 10 22 14 32 14s22-4 32-14l22 18c-10 8-16 20-16 38v90c0 10-8 16-16 16H178c-8 0-16-6-16-16v-90c0-18-6-30-16-38l22-18z"
              fill="#6f5644"
              fill-opacity="0.08"
              stroke="#6f5644"
              stroke-width="1.7"
            />
            <path
              class="atelier-stitch"
              d="M168 88c10 10 22 14 32 14s22-4 32-14l22 18c-10 8-16 20-16 38v90c0 10-8 16-16 16H178c-8 0-16-6-16-16v-90c0-18-6-30-16-38l22-18z"
              fill="none"
              stroke="#b8924a"
              stroke-width="1.5"
              stroke-dasharray="6 7"
            />
            <!-- waist dart -->
            <path d="M200 110v100" stroke="#fffdfc" stroke-opacity="0.5" stroke-width="1.2" stroke-dasharray="2 5" />
            <path d="M186 128c8 4 20 4 28 0" stroke="#9f4d62" stroke-opacity="0.45" stroke-width="1.2" stroke-linecap="round" />
          </g>

          <!-- scissors -->
          <g class="atelier-scissors">
            <circle cx="78" cy="168" r="10" stroke="#6f5644" stroke-width="2" fill="#fff" fill-opacity="0.7" />
            <circle cx="78" cy="196" r="10" stroke="#6f5644" stroke-width="2" fill="#fff" fill-opacity="0.7" />
            <path d="M78 178l42-38" stroke="#6f5644" stroke-width="2.4" stroke-linecap="round" />
            <path d="M78 186l48 8" stroke="#6f5644" stroke-width="2.4" stroke-linecap="round" />
            <path d="M118 142l8-4-2 10z" fill="#b8924a" />
          </g>

          <!-- thread spool -->
          <g class="atelier-spool">
            <rect x="308" y="150" width="36" height="52" rx="4" fill="#6f5644" fill-opacity="0.12" stroke="#6f5644" stroke-width="1.6" />
            <line x1="312" y1="160" x2="340" y2="160" stroke="#b8924a" stroke-width="1.4" />
            <line x1="312" y1="170" x2="340" y2="170" stroke="#6f5644" stroke-opacity="0.35" stroke-width="1.2" />
            <line x1="312" y1="180" x2="340" y2="180" stroke="#b8924a" stroke-width="1.4" />
            <line x1="312" y1="190" x2="340" y2="190" stroke="#6f5644" stroke-opacity="0.35" stroke-width="1.2" />
            <path
              class="atelier-thread-path"
              d="M326 150c-18-20-40-28-58-18"
              stroke="#9f4d62"
              stroke-width="1.4"
              stroke-dasharray="3 4"
              fill="none"
            />
          </g>

          <!-- measuring tape -->
          <g class="atelier-measure">
            <path
              d="M52 240c40-30 90-20 130-8s70 10 110-18"
              stroke="#b8924a"
              stroke-width="7"
              stroke-linecap="round"
              fill="none"
              opacity="0.85"
            />
            <path
              d="M52 240c40-30 90-20 130-8s70 10 110-18"
              stroke="#fff8e8"
              stroke-width="3.5"
              stroke-linecap="round"
              fill="none"
            />
            <g fill="#6f5644" font-size="7" font-family="Tahoma, sans-serif">
              <text x="70" y="236">۱</text>
              <text x="110" y="228">۲</text>
              <text x="155" y="226">۳</text>
              <text x="205" y="230">۴</text>
            </g>
          </g>

          <!-- floating tags -->
          <g class="atelier-tag atelier-tag-a">
            <rect x="28" y="88" width="70" height="28" rx="6" fill="#fff" stroke="#6f5644" stroke-opacity="0.3" />
            <text x="63" y="106" text-anchor="middle" fill="#6f5644" font-size="11" font-family="Tahoma, sans-serif">در حال دوخت</text>
          </g>
          <g class="atelier-tag atelier-tag-b">
            <rect x="300" y="72" width="64" height="26" rx="6" fill="#fff" stroke="#b8924a" stroke-opacity="0.45" />
            <text x="332" y="89" text-anchor="middle" fill="#9a7838" font-size="11" font-family="Tahoma, sans-serif">به‌روزرسانی</text>
          </g>
        </svg>
      </div>

      <p class="atelier-eyebrow mt-1 text-[11px] font-medium tracking-[0.28em] text-primary-700/75">
        ATELIER · CLOSED FOR ALTERATIONS
      </p>
      <h1 class="atelier-title mt-3 text-[1.65rem] font-semibold tracking-tight text-neutral-950 md:text-3xl">
        فروشگاه موقتاً در حال تعمیر است
      </h1>
      <p class="atelier-copy mt-3 max-w-md text-sm leading-7 text-neutral-600 md:text-[15px]">
        {{ description }}
      </p>

      <div class="atelier-steps mt-8 grid w-full max-w-md grid-cols-4 gap-2" aria-hidden="true">
        <div
          v-for="(step, index) in steps"
          :key="step.label"
          class="atelier-step"
          :class="{ 'is-active': !step.done && steps[index - 1]?.done, 'is-done': step.done }"
          :style="{ '--step-i': index }"
        >
          <span class="atelier-step-dot" />
          <span class="mt-1.5 block text-[10px] font-medium tracking-wide">{{ step.label }}</span>
        </div>
      </div>

      <div class="atelier-progress mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-primary-900/10" aria-hidden="true">
        <span class="atelier-progress-bar block h-full rounded-full bg-gradient-to-l from-[#b8924a] to-[#6f5644]" />
      </div>

      <p class="mt-4 flex items-center justify-center gap-2 text-xs tracking-wide text-primary-800/75">
        <span class="atelier-pulse-dot" />
        سوزن در حال دوخت فصل جدید است…
      </p>

      <slot />

      <p v-if="preview" class="mt-6 text-xs text-primary-700/70">
        پیش‌نمایش — هنوز برای مشتریان فعال نشده است.
      </p>
    </div>
  </div>
</template>

<style scoped>
.atelier {
  background:
    radial-gradient(ellipse 90% 55% at 50% -8%, rgba(101, 42, 59, 0.12), transparent 58%),
    radial-gradient(ellipse 50% 40% at 100% 100%, rgba(184, 146, 74, 0.12), transparent 50%),
    linear-gradient(168deg, #fffdfb 0%, #f6eef1 46%, #ebe2e6 100%);
  color: #171717;
}

.atelier-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.atelier-grid {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background-image:
    linear-gradient(rgba(101, 42, 59, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(101, 42, 59, 0.05) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%);
}

.atelier-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(52px);
  opacity: 0.55;
  animation: atelier-drift 16s ease-in-out infinite;
}

.atelier-blob-a {
  width: 20rem;
  height: 20rem;
  top: -5rem;
  right: -4rem;
  background: rgba(101, 42, 59, 0.18);
}

.atelier-blob-b {
  width: 16rem;
  height: 16rem;
  bottom: 6%;
  left: -5rem;
  background: rgba(184, 146, 74, 0.2);
  animation-delay: -5s;
}

.atelier-blob-c {
  width: 11rem;
  height: 11rem;
  top: 48%;
  right: 10%;
  background: rgba(159, 77, 98, 0.14);
  animation-delay: -9s;
}

.atelier-confetti {
  position: absolute;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 1px;
  background: rgba(101, 42, 59, 0.22);
  top: calc(4% + (var(--i) * 7.5%));
  left: calc(3% + (var(--i) * 7.8%));
  animation: atelier-bob 4.8s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.35s);
}

.atelier-confetti:nth-child(odd) {
  border-radius: 999px;
  background: rgba(184, 146, 74, 0.35);
  transform: rotate(25deg);
}

.atelier-tape {
  position: absolute;
  height: 10px;
  border-radius: 999px;
  background:
    repeating-linear-gradient(
      90deg,
      #b8924a 0 8px,
      #f5ecd4 8px 16px
    );
  opacity: 0.35;
  animation: atelier-tape-slide 18s linear infinite;
}

.atelier-tape-a {
  width: 140%;
  top: 18%;
  left: -20%;
  transform: rotate(-8deg);
}

.atelier-tape-b {
  width: 140%;
  bottom: 14%;
  left: -10%;
  transform: rotate(6deg);
  animation-direction: reverse;
  animation-duration: 22s;
  opacity: 0.22;
}

.atelier-mannequin {
  transform-origin: 200px 32px;
  animation: atelier-swing 4s ease-in-out infinite;
}

.atelier-stitch {
  animation: atelier-dash 3s linear infinite;
}

.atelier-scissors {
  transform-origin: 78px 182px;
  animation: atelier-snip 2.4s ease-in-out infinite;
}

.atelier-spool {
  transform-origin: 326px 176px;
  animation: atelier-spin 5s linear infinite;
}

.atelier-thread-path {
  animation: atelier-dash 2.2s linear infinite reverse;
}

.atelier-measure {
  animation: atelier-bob 5s ease-in-out infinite;
}

.atelier-tag {
  transform-box: fill-box;
  transform-origin: center;
}

.atelier-tag-a {
  animation: atelier-float-tag 4.4s ease-in-out infinite;
}

.atelier-tag-b {
  animation: atelier-float-tag 5.2s ease-in-out infinite reverse;
}

.atelier-eyebrow,
.atelier-title,
.atelier-copy,
.atelier-steps,
.atelier-progress {
  animation: atelier-rise 0.75s ease both;
}

.atelier-title { animation-delay: 0.08s; }
.atelier-copy { animation-delay: 0.14s; }
.atelier-steps { animation-delay: 0.2s; }
.atelier-progress { animation-delay: 0.26s; }

.atelier-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #a3a3a3;
}

.atelier-step.is-done {
  color: #6f5644;
}

.atelier-step.is-active {
  color: #9a7838;
}

.atelier-step-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.45;
}

.atelier-step.is-done .atelier-step-dot,
.atelier-step.is-active .atelier-step-dot {
  opacity: 1;
  box-shadow: 0 0 0 4px rgba(101, 42, 59, 0.08);
}

.atelier-step.is-active .atelier-step-dot {
  animation: atelier-pulse 1.4s ease-in-out infinite;
}

.atelier-progress-bar {
  width: 58%;
  animation: atelier-progress 2.8s ease-in-out infinite;
}

.atelier-pulse-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: #6f5644;
  animation: atelier-pulse 1.5s ease-in-out infinite;
}

@keyframes atelier-swing {
  0%, 100% { transform: rotate(-3.5deg); }
  50% { transform: rotate(3.5deg); }
}

@keyframes atelier-snip {
  0%, 100% { transform: rotate(-12deg); }
  50% { transform: rotate(8deg); }
}

@keyframes atelier-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes atelier-dash {
  to { stroke-dashoffset: -48; }
}

@keyframes atelier-float-tag {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-9px) rotate(2deg); }
}

@keyframes atelier-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

@keyframes atelier-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-16px, 20px) scale(1.06); }
}

@keyframes atelier-tape-slide {
  from { transform: translateX(0) rotate(var(--tape-rot, -8deg)); }
  to { transform: translateX(-8%) rotate(var(--tape-rot, -8deg)); }
}

@keyframes atelier-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.05); }
}

@keyframes atelier-progress {
  0%, 100% { width: 42%; }
  50% { width: 72%; }
}

@keyframes atelier-rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .atelier-blob,
  .atelier-confetti,
  .atelier-tape,
  .atelier-mannequin,
  .atelier-stitch,
  .atelier-scissors,
  .atelier-spool,
  .atelier-thread-path,
  .atelier-measure,
  .atelier-tag,
  .atelier-eyebrow,
  .atelier-title,
  .atelier-copy,
  .atelier-steps,
  .atelier-progress,
  .atelier-progress-bar,
  .atelier-pulse-dot,
  .atelier-step.is-active .atelier-step-dot {
    animation: none !important;
  }
}
</style>
