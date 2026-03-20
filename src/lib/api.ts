const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://laptop-rental-api.loc/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
      localStorage.removeItem('auth_token');
      window.location.href = '/auth/login';
    }
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ success: boolean; data: { user: any; token: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request<{ success: boolean; data: any }>('/auth/me'),
    changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
      request<any>('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (email: string) =>
      request<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (data: { email: string; otp: string; password: string; password_confirmation: string }) =>
      request<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: any) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  },

  inventory: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/inventories${qs}`);
    },
    available: () => request<any>('/inventories/available'),
    get: (id: number) => request<any>(`/inventories/${id}`),
    create: (data: any) =>
      request<any>('/inventories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/inventories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<any>(`/inventories/${id}`, { method: 'DELETE' }),
    import: async (file: File) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${BASE_URL}/inventories/import`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
          localStorage.removeItem('auth_token');
          window.location.href = '/auth/login';
        }
        throw { message: data.message, failures: data.failures };
      }
      return data;
    },
  },

  vendor: {
    // Returns the authenticated vendor's assigned stock
    stock: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/vendor/inventories${qs}`);
    },
    // Vendor's own reported issues
    myIssues: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/vendor/issues${qs}`);
    },
  },

  issues: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/issues${qs}`);
    },
    get: (id: number) => request<any>(`/issues/${id}`),
    create: (data: any) =>
      request<any>('/issues', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    resolve: (id: number, admin_notes?: string) =>
      request<any>(`/issues/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ admin_notes }),
      }),
    close: (id: number) =>
      request<any>(`/issues/${id}/close`, { method: 'POST' }),
  },

  rentals: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/rentals${qs}`);
    },
    get: (id: number) => request<any>(`/rentals/${id}`),
    create: (data: any) =>
      request<any>('/rentals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/rentals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    complete: (id: number) =>
      request<any>(`/rentals/${id}/complete`, { method: 'POST' }),
    cancel: (id: number) =>
      request<any>(`/rentals/${id}/cancel`, { method: 'POST' }),
    overdue: () => request<any>('/rentals/overdue'),
    calculateBilling: (data: any) =>
      request<any>('/rentals/calculate-billing', { method: 'POST', body: JSON.stringify(data) }),
  },

  users: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/users${qs}`);
    },
    get: (id: number) => request<any>(`/users/${id}`),
    update: (id: number, data: any) =>
      request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<any>(`/users/${id}`, { method: 'DELETE' }),
  },

  dashboard: {
    summary: () => request<any>('/dashboard/summary'),
  },
};
