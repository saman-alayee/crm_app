export default defineNuxtPlugin({
  name: 'auth-init',
  dependsOn: ['pinia'],
  setup() {
    useAuthStore().init();
  },
});
