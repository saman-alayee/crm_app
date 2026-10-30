<template>
  <div class="dash-skel" aria-hidden="true">
    <div class="dash-skel__hero">
      <div class="dash-skel__bar dash-skel__bar--lg" />
      <div class="dash-skel__bar dash-skel__bar--md" />
    </div>
    <div class="dash-skel__stats">
      <div v-for="i in 6" :key="i" class="dash-skel__card" :style="{ animationDelay: `${i * 70}ms` }">
        <div class="dash-skel__bar dash-skel__bar--xs" />
        <div class="dash-skel__bar dash-skel__bar--num" />
      </div>
    </div>
    <div class="dash-skel__split">
      <div class="dash-skel__panel" style="animation-delay: 420ms">
        <div class="dash-skel__bar dash-skel__bar--sm" />
        <div class="dash-skel__bar" />
        <div class="dash-skel__bar dash-skel__bar--md" />
      </div>
      <div class="dash-skel__panel" style="animation-delay: 490ms">
        <div class="dash-skel__bar dash-skel__bar--sm" />
        <div class="dash-skel__bar" />
        <div class="dash-skel__bar dash-skel__bar--md" />
      </div>
    </div>
  </div>
</template>
