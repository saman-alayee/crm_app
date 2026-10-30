export function useDirtyForm(isDirty: Ref<boolean> | (() => boolean)) {
  const getDirty = () => (typeof isDirty === 'function' ? isDirty() : isDirty.value);

  function confirmLeave() {
    if (!getDirty()) return true;
    return window.confirm('تغییرات ذخیره‌نشده دارید. خارج می‌شوید؟');
  }

  onBeforeRouteLeave((_to, _from, next) => {
    if (confirmLeave()) next();
    else next(false);
  });

  if (import.meta.client) {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!getDirty()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    onMounted(() => window.addEventListener('beforeunload', onBeforeUnload));
    onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload));
  }

  return { confirmLeave };
}
