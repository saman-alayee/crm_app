import { botConfig } from './config.js';

type ApiOk<T> = { success: true; data: T; message?: string };
type ApiErr = { success: false; message?: string; code?: string };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${botConfig.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-bot-key': botConfig.botKey,
      ...(init.headers || {}),
    },
  });
  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || !('success' in json) || !json.success) {
    const err = new Error((json as ApiErr).message || `HTTP ${res.status}`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = (json as ApiErr).code;
    err.status = res.status;
    throw err;
  }
  return (json as ApiOk<T>).data;
}

export const botApi = {
  link(body: {
    username: string;
    password: string;
    telegramUserId: string;
    telegramUsername?: string;
  }) {
    return call<{
      displayName: string;
      permissions: string[];
      username: string;
    }>('/bot/auth/link', { method: 'POST', body: JSON.stringify(body) });
  },
  unlink(telegramUserId: string) {
    return call('/bot/auth/unlink', {
      method: 'POST',
      body: JSON.stringify({ telegramUserId }),
    });
  },
  me(telegramUserId: string) {
    return call<{
      userId: string;
      username: string;
      firstName: string;
      lastName: string;
      permissions: string[];
    }>(`/bot/me?telegramUserId=${encodeURIComponent(telegramUserId)}`);
  },
  menu(telegramUserId: string) {
    return call<{
      displayName: string;
      items: { id: string; label: string }[];
      permissions: string[];
    }>(`/bot/menu?telegramUserId=${encodeURIComponent(telegramUserId)}`);
  },
  dashboard(telegramUserId: string) {
    return call<{
      leavePending: number;
      salaryPending: number;
      tasksOpen: number;
      tasksMine: number;
      unread: number;
    }>(`/bot/dashboard?telegramUserId=${encodeURIComponent(telegramUserId)}`);
  },
  leave(telegramUserId: string, status?: string) {
    const q = new URLSearchParams({ telegramUserId });
    if (status) q.set('status', status);
    return call<{ items: any[] }>(`/bot/leave?${q}`);
  },
  createLeave(body: Record<string, unknown>) {
    return call('/bot/leave', { method: 'POST', body: JSON.stringify(body) });
  },
  decideLeave(id: string, body: Record<string, unknown>) {
    return call(`/bot/leave/${id}/decide`, { method: 'POST', body: JSON.stringify(body) });
  },
  salary(telegramUserId: string, status?: string) {
    const q = new URLSearchParams({ telegramUserId });
    if (status) q.set('status', status);
    return call<{ items: any[] }>(`/bot/salary?${q}`);
  },
  createSalary(body: Record<string, unknown>) {
    return call('/bot/salary', { method: 'POST', body: JSON.stringify(body) });
  },
  decideSalary(id: string, body: Record<string, unknown>) {
    return call(`/bot/salary/${id}/decide`, { method: 'POST', body: JSON.stringify(body) });
  },
  tasks(telegramUserId: string) {
    return call<{ items: any[] }>(
      `/bot/tasks?telegramUserId=${encodeURIComponent(telegramUserId)}`
    );
  },
  completeTask(id: string, telegramUserId: string) {
    return call(`/bot/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ telegramUserId }),
    });
  },
  notifications(telegramUserId: string) {
    return call<{ items: any[]; unreadCount: number }>(
      `/bot/notifications?telegramUserId=${encodeURIComponent(telegramUserId)}`
    );
  },
  readAllNotifications(telegramUserId: string) {
    return call('/bot/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ telegramUserId }),
    });
  },
  announcements(telegramUserId: string) {
    return call<{ items: any[] }>(
      `/bot/announcements?telegramUserId=${encodeURIComponent(telegramUserId)}`
    );
  },
  employees(telegramUserId: string) {
    return call<{ items: any[] }>(
      `/bot/employees?telegramUserId=${encodeURIComponent(telegramUserId)}`
    );
  },
  departments(telegramUserId: string) {
    return call<{ items: any[] }>(
      `/bot/departments?telegramUserId=${encodeURIComponent(telegramUserId)}`
    );
  },
  bankMe(telegramUserId: string) {
    return call<any>(`/bot/bank/me?telegramUserId=${encodeURIComponent(telegramUserId)}`);
  },
  reports(telegramUserId: string) {
    return call<{ employees: number; leaveApproved: number; tasksDone: number }>(
      `/bot/reports/summary?telegramUserId=${encodeURIComponent(telegramUserId)}`
    );
  },
};
