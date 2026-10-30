type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const toasts = ref<ToastItem[]>([]);
let toastId = 0;

export function useToast() {
  function show(message: string, type: ToastType = 'info') {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    const duration = type === 'error' ? 6000 : 3500;
    setTimeout(() => dismiss(id), duration);
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    show,
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    info: (message: string) => show(message, 'info'),
    dismiss,
  };
}
