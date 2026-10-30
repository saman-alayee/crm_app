<script setup lang="ts">
withDefaults(
  defineProps<{
    code?: number | string;
    title: string;
    description: string;
    eyebrow?: string;
    showCategories?: boolean;
  }>(),
  {
    code: 404,
    eyebrow: 'OUT OF STOCK · PAGE',
    showCategories: true,
  },
);

const emit = defineEmits<{
  home: [];
  categories: [];
  back: [];
}>();
</script>

<template>
  <div class="err min-h-[100dvh] overflow-hidden">
    <div class="err-bg" aria-hidden="true">
      <span class="err-blob err-blob-a" />
      <span class="err-blob err-blob-b" />
      <span class="err-blob err-blob-c" />
      <span class="err-float" style="--i: 1" />
      <span class="err-float" style="--i: 2" />
      <span class="err-float" style="--i: 3" />
      <span class="err-float" style="--i: 4" />
      <span class="err-float" style="--i: 5" />
      <span class="err-float" style="--i: 6" />
      <span class="err-float" style="--i: 7" />
      <span class="err-float" style="--i: 8" />
    </div>

    <div class="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-5 py-12 text-center">
      <slot name="brand" />

      <div class="err-stage relative mb-2 w-full max-w-md">
        <svg
          class="err-art mx-auto h-auto w-full max-w-[22rem]"
          viewBox="0 0 360 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="چوبه لباس خالی"
        >
          <line
            x1="48"
            y1="28"
            x2="312"
            y2="28"
            stroke="#6f5644"
            stroke-opacity="0.22"
            stroke-width="3"
            stroke-linecap="round"
          />
          <circle cx="48" cy="28" r="4" fill="#6f5644" fill-opacity="0.35" />
          <circle cx="312" cy="28" r="4" fill="#6f5644" fill-opacity="0.35" />

          <g class="err-hanger">
            <path
              d="M180 28c0-14 18-14 18 2 0 10-8 14-12 20"
              stroke="#6f5644"
              stroke-width="3"
              stroke-linecap="round"
              fill="none"
            />
            <path
              d="M186 50 112 118c-6 8 2 14 10 14h128c8 0 16-6 10-14L186 50z"
              fill="none"
              stroke="#6f5644"
              stroke-width="3"
              stroke-linejoin="round"
            />
            <path
              d="M132 122h96"
              stroke="#6f5644"
              stroke-width="2.4"
              stroke-linecap="round"
            />

            <g class="err-garment" transform="translate(0 42)">
              <path
                d="M126 86c10 8 22 12 54 12s44-4 54-12l18 22c-8 6-14 18-14 34v78c0 8-6 14-14 14H136c-8 0-14-6-14-14v-78c0-16-6-28-14-34l18-22z"
                fill="#6f5644"
                fill-opacity="0.07"
                stroke="#6f5644"
                stroke-opacity="0.45"
                stroke-width="1.6"
                stroke-dasharray="6 5"
                class="err-stitch"
              />
              <path
                d="M168 98v16M180 98v16M192 98v16"
                stroke="#6f5644"
                stroke-opacity="0.35"
                stroke-width="1.4"
                stroke-linecap="round"
              />
              <path
                d="M214 168c10-6 22-4 28 6"
                stroke="#9f4d62"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-dasharray="3 4"
                class="err-thread"
              />
            </g>
          </g>

          <g class="err-tag err-tag-a">
            <rect
              x="42"
              y="148"
              width="54"
              height="28"
              rx="4"
              fill="#fff"
              stroke="#6f5644"
              stroke-opacity="0.35"
            />
            <text
              x="69"
              y="166"
              text-anchor="middle"
              fill="#6f5644"
              font-size="11"
              font-family="Tahoma, sans-serif"
            >
              سایز؟
            </text>
          </g>
          <g class="err-tag err-tag-b">
            <rect
              x="268"
              y="120"
              width="48"
              height="26"
              rx="4"
              fill="#fff"
              stroke="#b8924a"
              stroke-opacity="0.5"
            />
            <text
              x="292"
              y="137"
              text-anchor="middle"
              fill="#9a7838"
              font-size="11"
              font-family="Tahoma, sans-serif"
            >
              ۴۰۴
            </text>
          </g>

          <circle class="err-dot err-dot-1" cx="78" cy="210" r="5" fill="#6f5644" fill-opacity="0.35" />
          <circle class="err-dot err-dot-2" cx="290" cy="200" r="4" fill="#b8924a" fill-opacity="0.55" />
          <circle class="err-dot err-dot-3" cx="110" cy="118" r="3.5" fill="#9f4d62" fill-opacity="0.4" />
          <circle class="err-dot err-dot-4" cx="250" cy="230" r="3" fill="#6f5644" fill-opacity="0.3" />
        </svg>

        <p
          class="err-code pointer-events-none absolute inset-x-0 top-[42%] text-[clamp(4.5rem,18vw,7rem)] font-bold leading-none tracking-tight text-primary-800/10"
          aria-hidden="true"
        >
          {{ code }}
        </p>
      </div>

      <p class="err-eyebrow mt-2 text-[11px] font-medium tracking-[0.22em] text-primary-700/80">
        {{ eyebrow }}
      </p>
      <h1 class="err-title mt-3 text-2xl font-semibold tracking-tight text-neutral-950 md:text-3xl">
        {{ title }}
      </h1>
      <p class="err-copy mt-3 max-w-md text-sm leading-7 text-neutral-600 md:text-[15px]">
        {{ description }}
      </p>

      <div class="err-actions mt-9 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <button type="button" class="btn-primary btn-action min-w-[10rem]" @click="emit('home')">
          بازگشت به فروشگاه
        </button>
        <button
          v-if="showCategories"
          type="button"
          class="btn-secondary btn-action min-w-[10rem]"
          @click="emit('categories')"
        >
          دیدن کالکشن‌ها
        </button>
        <button
          v-else
          type="button"
          class="btn-secondary btn-action min-w-[10rem]"
          @click="emit('back')"
        >
          صفحه قبل
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.err {
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(101, 42, 59, 0.1), transparent 55%),
    linear-gradient(165deg, #fffdfc 0%, #f7f0f2 48%, #efe6e9 100%);
  color: #171717;
}

.err-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.err-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(48px);
  opacity: 0.55;
  animation: err-drift 14s ease-in-out infinite;
}

.err-blob-a {
  width: 18rem;
  height: 18rem;
  top: -4rem;
  right: -3rem;
  background: rgba(101, 42, 59, 0.16);
}

.err-blob-b {
  width: 14rem;
  height: 14rem;
  bottom: 8%;
  left: -4rem;
  background: rgba(184, 146, 74, 0.18);
  animation-delay: -4s;
  animation-duration: 18s;
}

.err-blob-c {
  width: 10rem;
  height: 10rem;
  top: 42%;
  right: 12%;
  background: rgba(159, 77, 98, 0.12);
  animation-delay: -8s;
  animation-duration: 16s;
}

.err-float {
  position: absolute;
  width: 1.25rem;
  height: 1.25rem;
  border: 1.5px solid rgba(101, 42, 59, 0.22);
  border-radius: 999px;
  top: calc(8% + (var(--i) * 10%));
  left: calc(6% + (var(--i) * 11%));
  animation: err-bob 5.5s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.55s);
}

.err-float:nth-child(odd) {
  border-radius: 2px;
  transform: rotate(18deg);
}

.err-hanger {
  transform-origin: 180px 28px;
  animation: err-swing 3.6s ease-in-out infinite;
}

.err-garment {
  transform-origin: 180px 86px;
  animation: err-flutter 3.6s ease-in-out infinite;
}

.err-stitch {
  animation: err-dash 4.5s linear infinite;
}

.err-thread {
  animation: err-dash 2.8s linear infinite reverse;
}

.err-tag {
  transform-box: fill-box;
  transform-origin: center;
}

.err-tag-a {
  animation: err-float-tag 4.2s ease-in-out infinite;
}

.err-tag-b {
  animation: err-float-tag 5s ease-in-out infinite reverse;
  animation-delay: -1s;
}

.err-dot {
  animation: err-bob 3.8s ease-in-out infinite;
}

.err-dot-1 {
  animation-delay: -0.4s;
}
.err-dot-2 {
  animation-delay: -1.2s;
}
.err-dot-3 {
  animation-delay: -0.8s;
}
.err-dot-4 {
  animation-delay: -1.6s;
}

.err-code {
  animation: err-pulse 5s ease-in-out infinite;
}

.err-eyebrow,
.err-title,
.err-copy,
.err-actions {
  animation: err-rise 0.7s ease both;
}

.err-title {
  animation-delay: 0.08s;
}
.err-copy {
  animation-delay: 0.16s;
}
.err-actions {
  animation-delay: 0.24s;
}

@keyframes err-swing {
  0%,
  100% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(5deg);
  }
}

@keyframes err-flutter {
  0%,
  100% {
    transform: translateY(0) skewX(0deg);
    opacity: 0.95;
  }
  50% {
    transform: translateY(5px) skewX(-1.2deg);
    opacity: 0.72;
  }
}

@keyframes err-dash {
  to {
    stroke-dashoffset: -44;
  }
}

@keyframes err-float-tag {
  0%,
  100% {
    transform: translateY(0) rotate(-3deg);
  }
  50% {
    transform: translateY(-10px) rotate(3deg);
  }
}

@keyframes err-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes err-drift {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-18px, 22px) scale(1.08);
  }
}

@keyframes err-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.03);
  }
}

@keyframes err-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .err-blob,
  .err-float,
  .err-hanger,
  .err-garment,
  .err-stitch,
  .err-thread,
  .err-tag,
  .err-dot,
  .err-code,
  .err-eyebrow,
  .err-title,
  .err-copy,
  .err-actions {
    animation: none !important;
  }
}
</style>
