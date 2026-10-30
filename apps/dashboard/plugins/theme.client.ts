export default defineNuxtPlugin(() => {
  const theme = useTheme();
  theme.loadLocal();
  void theme.syncFromServer();
});
