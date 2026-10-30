export default defineNuxtPlugin({
  name: 'favorites-init',
  dependsOn: ['pinia'],
  setup() {
    const { fetchFavorites } = useFavorites();
    void fetchFavorites();
  },
});
