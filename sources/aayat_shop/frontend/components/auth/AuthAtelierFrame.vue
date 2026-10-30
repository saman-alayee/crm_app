<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'guest' | 'staff';
    backTo?: string;
    backLabel?: string;
  }>(),
  {
    variant: 'guest',
    backTo: '/',
    backLabel: 'بازگشت به فروشگاه',
  }
);
</script>

<template>
  <div class="auth-stage" :class="`is-${variant}`">
    <div class="auth-stage__glow" aria-hidden="true" />
    <svg class="auth-stage__scene" viewBox="0 0 420 240" aria-hidden="true">
      <path class="rail" d="M24 34h372" />
      <g class="hanger hanger-a">
        <path class="hook" d="M86 34c0-16 20-16 20 2 0 12-10 16-14 22" />
        <path class="body" d="M92 58c-28 2-52 18-52 38 0 10 8 16 18 16h72c10 0 18-6 18-16 0-20-24-36-56-38z" />
        <path class="bar" d="M52 100h80" />
      </g>
      <g class="hanger hanger-b">
        <path class="hook" d="M198 34c0-16 20-16 20 2 0 12-10 16-14 22" />
        <path class="body" d="M204 58 132 118c-6 8 2 14 10 14h124c8 0 16-6 10-14L204 58z" />
        <path class="bar" d="M156 124h96" />
      </g>
      <g class="hanger hanger-c">
        <path class="hook" d="M318 34c0-16 20-16 20 2 0 12-10 16-14 22" />
        <path class="body" d="M248 104c28-8 52-28 76-46 24 18 48 38 76 46" />
        <path class="bar" d="M248 104h152" />
      </g>
      <path class="thread" d="M18 180c40-18 70 22 110 4s70 24 110 2 68 20 100-6 62 16 74-8" />
    </svg>

    <div class="auth-stage__panel">
      <div class="mb-5 flex justify-center">
        <AppLogo size="lg" />
      </div>
      <slot />
    </div>

    <NuxtLink v-if="backTo" :to="backTo" class="auth-stage__back">{{ backLabel }}</NuxtLink>
  </div>
</template>

<style scoped>
.auth-stage {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 2.5rem 1rem 3rem;
}

.auth-stage.is-guest {
  background:
    radial-gradient(circle at 50% 0%, rgba(122, 51, 71, 0.16), transparent 42%),
    linear-gradient(180deg, #fbf7f4 0%, #f3e8eb 100%);
  color: #49202d;
}

.auth-stage.is-staff {
  background:
    radial-gradient(circle at 50% 0%, rgba(201, 169, 98, 0.18), transparent 36%),
    linear-gradient(165deg, #2a1820 0%, #120c0f 70%);
  color: #f6efe8;
}

.auth-stage__glow {
  position: absolute;
  width: 18rem;
  height: 18rem;
  border-radius: 999px;
  filter: blur(8px);
  opacity: 0.45;
  animation: pulse 7s ease-in-out infinite;
}

.is-guest .auth-stage__glow {
  background: rgba(185, 122, 138, 0.35);
}

.is-staff .auth-stage__glow {
  background: rgba(201, 169, 98, 0.2);
}

.auth-stage__scene {
  position: absolute;
  top: 0.5rem;
  width: min(100%, 34rem);
  height: 15rem;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.is-guest .auth-stage__scene {
  stroke: #7a3347;
}

.is-staff .auth-stage__scene {
  stroke: #e7d3a1;
}

.rail {
  stroke-width: 3;
}

.hook {
  fill: none;
  stroke-width: 3.2;
}

.body,
.bar,
.notch {
  fill: none;
  stroke-width: 2.6;
}

.is-guest .hanger-a .body,
.is-guest .hanger-a .hook,
.is-guest .hanger-a .bar { stroke: #2f9e8f; }
.is-guest .hanger-b .body,
.is-guest .hanger-b .hook,
.is-guest .hanger-b .bar { stroke: #7a3347; }
.is-guest .hanger-c .body,
.is-guest .hanger-c .hook,
.is-guest .hanger-c .bar { stroke: #c4922a; }

.is-staff .hanger-a .body,
.is-staff .hanger-a .hook,
.is-staff .hanger-a .bar { stroke: #e7d3a1; }
.is-staff .hanger-b .body,
.is-staff .hanger-b .hook,
.is-staff .hanger-b .bar { stroke: #f3e8eb; }
.is-staff .hanger-c .body,
.is-staff .hanger-c .hook,
.is-staff .hanger-c .bar { stroke: #f6efe8; }

.hanger {
  transform-box: fill-box;
  transform-origin: top center;
  animation: sway 4.8s ease-in-out infinite;
}

.hanger-b {
  animation-duration: 5.6s;
  animation-delay: -1.2s;
}

.hanger-c {
  animation-duration: 4.2s;
  animation-delay: -2s;
}

.thread {
  stroke-width: 1.2;
  stroke-dasharray: 8 10;
  animation: stitch 9s linear infinite;
  opacity: 0.7;
}

.auth-stage__panel {
  position: relative;
  z-index: 1;
  width: min(100%, 24rem);
  margin-top: 7.5rem;
  border-radius: 1.6rem;
  padding: 1.5rem 1.35rem 1.35rem;
  backdrop-filter: blur(10px);
}

.is-guest .auth-stage__panel {
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 18px 50px rgba(73, 32, 45, 0.12);
}

.is-staff .auth-stage__panel {
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
}

.auth-stage__back {
  position: relative;
  z-index: 1;
  margin-top: 1.1rem;
  font-size: 0.85rem;
}

.is-guest .auth-stage__back {
  color: #7a3347;
}

.is-staff .auth-stage__back {
  color: rgba(246, 239, 232, 0.72);
}

@keyframes sway {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(5deg);
  }
}

@keyframes stitch {
  to {
    stroke-dashoffset: -180;
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(0.92);
  }
  50% {
    transform: scale(1.08);
  }
}
</style>
