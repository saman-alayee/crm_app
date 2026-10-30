import { defineStore } from 'pinia';
import type { User } from '~/types';
import { normalizeDigits, normalizePhoneInput } from '~/utils/normalize';
import { getRoleFromToken, parseJwtPayload } from '~/utils/jwt';

export const useAuthStore = defineStore('auth', () => {
  const tokenCookie = useCookie<string | null>('auth-token', {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
  });
  const userCookie = useCookie<string | null>('auth-user', {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
  });

  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => {
    const fromUser = user.value?.role;
    const fromToken = getRoleFromToken(token.value);
    const role = (fromUser && (fromUser === 'ADMIN' || fromUser === 'SUPERVISOR' || fromUser === 'STAFF')
      ? fromUser
      : fromToken) ?? fromUser;
    return role === 'ADMIN' || role === 'SUPERVISOR' || role === 'STAFF';
  });
  const fullName = computed(() => {
    if (!user.value) return '';
    const { firstName, lastName } = user.value;
    if (firstName && lastName) return `${firstName} ${lastName}`;
    return user.value.phone;
  });

  function syncUserFromToken() {
    if (!token.value) return;

    const payload = parseJwtPayload(token.value);
    if (!payload?.userId) return;

    const role = payload.role ?? 'CUSTOMER';

    if (!user.value) {
      user.value = {
        id: payload.userId,
        phone: payload.phone ?? '',
        firstName: null,
        lastName: null,
        role,
      };
      userCookie.value = JSON.stringify(user.value);
      return;
    }

    if (user.value.role !== role) {
      user.value = { ...user.value, role };
      userCookie.value = JSON.stringify(user.value);
    }
  }

  function init() {
    if (initialized.value && token.value) {
      syncUserFromToken();
      return;
    }

    if (tokenCookie.value) {
      token.value = tokenCookie.value;
    }
    if (userCookie.value) {
      try {
        user.value = JSON.parse(userCookie.value) as User;
      } catch {
        user.value = null;
      }
    }

    syncUserFromToken();
    initialized.value = true;
  }

  function setAuth(newToken: string, newUser: User) {
    token.value = newToken;
    user.value = newUser;
    tokenCookie.value = newToken;
    userCookie.value = JSON.stringify(newUser);
    initialized.value = true;
    syncUserFromToken();
  }

  function logout() {
    token.value = null;
    user.value = null;
    tokenCookie.value = null;
    userCookie.value = null;
    initialized.value = false;
  }

  async function startAuth(phone: string, intent?: 'otp' | 'forgot') {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{
        step: 'signIn' | 'loginByOtp' | 'loginByPassword' | 'forgotPassword';
        hasPassword: boolean;
        message: string;
      }>('/auth/start', {
        phone: normalizePhoneInput(phone),
        intent,
      });
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function verifyForgotOtp(phone: string, code: string) {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{ resetToken: string }>('/auth/forgot/verify', {
        phone: normalizePhoneInput(phone),
        code: normalizeDigits(code),
      });
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function resetPassword(resetToken: string, password: string) {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{ token: string; user: User }>('/auth/forgot/reset', {
        resetToken,
        password,
      });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function sendOtp(phone: string) {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{ message: string }>('/auth/send-otp', {
        phone: normalizePhoneInput(phone),
      });
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function verifyOtp(phone: string, code: string) {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{ token: string; user: User }>('/auth/verify-otp', {
        phone: normalizePhoneInput(phone),
        code: normalizeDigits(code),
      });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function loginWithPassword(phone: string, password: string) {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{ token: string; user: User }>('/auth/login-password', {
        phone: normalizePhoneInput(phone),
        password,
      });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function loginAdminWithPassword(phone: string, password: string) {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{ token: string; user: User }>('/auth/admin/login-password', {
        phone: normalizePhoneInput(phone),
        password,
      });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function verifyAdminOtp(phone: string, code: string) {
    loading.value = true;
    try {
      const api = useApi();
      const { data } = await api.post<{ token: string; user: User }>('/auth/admin/verify-otp', {
        phone: normalizePhoneInput(phone),
        code: normalizeDigits(code),
      });
      setAuth(data.token, data.user);
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchProfile() {
    const api = useApi();
    const { data } = await api.get<User & { token?: string }>('/auth/profile');
    const { token: freshToken, ...profile } = data;
    user.value = profile;
    userCookie.value = JSON.stringify(profile);
    if (freshToken) {
      token.value = freshToken;
      tokenCookie.value = freshToken;
    }
    syncUserFromToken();
    return profile;
  }

  async function updateProfile(data: { firstName?: string; lastName?: string }) {
    const api = useApi();
    const { data: updatedUser } = await api.put<User>('/auth/profile', data);
    user.value = updatedUser;
    userCookie.value = JSON.stringify(updatedUser);
    return updatedUser;
  }

  return {
    user,
    token,
    loading,
    isLoggedIn,
    isAdmin,
    fullName,
    init,
    setAuth,
    logout,
    sendOtp,
    startAuth,
    verifyForgotOtp,
    resetPassword,
    verifyOtp,
    loginWithPassword,
    loginAdminWithPassword,
    verifyAdminOtp,
    fetchProfile,
    updateProfile,
  };
});
