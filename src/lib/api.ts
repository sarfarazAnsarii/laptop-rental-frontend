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
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

// Auth
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ success: boolean; data: { user: any; token: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request<{ success: boolean; data: any }>('/auth/me'),
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

  dashboard: {
    summary: () => request<any>('/dashboard/summary'),
  },
};
