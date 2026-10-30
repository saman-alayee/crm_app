import type { ApiResponse } from '~/types';

export function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const apiBase = config.public.apiBase.trim().replace(/\/$/, '');

  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }

    const sessionId = useCookie('session-id');
    if (sessionId.value) {
      headers['X-Session-Id'] = sessionId.value;
    }

    const url = `${apiBase}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        ...options,
        headers,
      });
    } catch {
      throw new Error('اتصال به سرور برقرار نشد. بک‌اند را روی پورت ۳۰۰۱ اجرا کنید.');
    }

    let data: ApiResponse<T> & { message?: string; errors?: { message?: string }[] };
    try {
      data = await response.json();
    } catch {
      throw new Error(`پاسخ نامعتبر از سرور (${response.status})`);
    }

    if (!response.ok) {
      const fieldError = Array.isArray(data.errors) ? data.errors[0]?.message : undefined;
      throw new Error(fieldError || data.message || 'خطایی رخ داد');
    }

    // Save session ID from cart responses
    if (data.data?.sessionId) {
      sessionId.value = data.data.sessionId;
    }

    return data;
  }

  async function upload<T>(
    endpoint: string,
    file: File,
    fieldName = 'image'
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }

    const response = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'خطا در آپلود فایل');
    }

    return data;
  }

  return {
    get: <T>(endpoint: string) => request<T>(endpoint),
    post: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(endpoint: string) =>
      request<T>(endpoint, { method: 'DELETE' }),
    upload,
  };
}
