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
    uploadImages: async (id: number, files: File[]) => {
      const token = getToken();
      const body = new FormData();
      files.forEach(f => body.append('images[]', f));
      const res = await fetch(`${BASE_URL}/inventories/${id}/images`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw { message: data.message };
      return data;
    },
    deleteImage: (id: number, index: number) =>
      request<any>(`/inventories/${id}/images/${index}`, { method: 'DELETE' }),
  },

  vendor: {
    stock: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/vendor/inventories${qs}`);
    },
    myIssues: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/vendor/issues${qs}`);
    },
  },

  client: {
    myRentals: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/client/rentals${qs}`);
    },
    myIssues: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/client/issues${qs}`);
    },
    mySchedules: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/client/schedules${qs}`);
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
    createBulk: async (data: any) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch(`${BASE_URL}/rentals/bulk`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw { message: body.message, unavailable: body.unavailable };
      return body;
    },
    update: (id: number, data: any) =>
      request<any>(`/rentals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    complete: (id: number, data?: { end_date?: string; notes?: string }) =>
      request<any>(`/rentals/${id}/complete`, { method: 'POST', body: JSON.stringify(data || {}) }),
    cancel: (id: number, data?: { end_date?: string; notes?: string }) =>
      request<any>(`/rentals/${id}/cancel`, { method: 'POST', body: JSON.stringify(data || {}) }),
    partialCancel: (data: { rental_ids: number[]; end_date: string; notes?: string }) =>
      request<any>('/rentals/partial-cancel', { method: 'POST', body: JSON.stringify(data) }),
    sendInvoice: (id: number, extra?: {
      subject?: string; body?: string;
      return_date?: string; deduction_amount?: number; deduction_reason?: string;
    }) =>
      request<any>(`/rentals/${id}/send-invoice`, {
        method: 'POST',
        body: JSON.stringify({ attach_invoice: true, ...extra }),
      }),
    sendAdvanceInvoice: (id: number, advance_days = 30, extra?: Record<string, any>) =>
      request<any>(`/rentals/${id}/send-advance-invoice`, {
        method: 'POST',
        body: JSON.stringify({ advance_days, attach_invoice: true, ...extra }),
      }),
    sendBulkAdvanceInvoice: (bulkId: string, advance_days = 30) =>
      request<any>(`/rentals/bulk/${bulkId}/send-advance-invoice`, {
        method: 'POST',
        body: JSON.stringify({ advance_days, attach_invoice: true }),
      }),
    overdue: () => request<any>('/rentals/overdue'),
    calculateBilling: (data: any) =>
      request<any>('/rentals/calculate-billing', { method: 'POST', body: JSON.stringify(data) }),

    // Per-rental schedules
    schedules: {
      list: (rentalId: number) =>
        request<any>(`/rentals/${rentalId}/schedules`),
      schedulePickup: (rentalId: number, data: any) =>
        request<any>(`/rentals/${rentalId}/schedule-pickup`, { method: 'POST', body: JSON.stringify(data) }),
      scheduleDelivery: (rentalId: number, data: any) =>
        request<any>(`/rentals/${rentalId}/schedule-delivery`, { method: 'POST', body: JSON.stringify(data) }),
    },
    // Bulk schedules
    bulkSchedules: {
      schedulePickup: (bulkId: string, data: any) =>
        request<any>(`/rentals/bulk/${bulkId}/schedule-pickup`, { method: 'POST', body: JSON.stringify(data) }),
      scheduleDelivery: (bulkId: string, data: any) =>
        request<any>(`/rentals/bulk/${bulkId}/schedule-delivery`, { method: 'POST', body: JSON.stringify(data) }),
    },
  },

  // Global schedule actions (admin/staff)
  schedules: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/schedules${qs}`);
    },
    complete: (scheduleId: number, notes?: string) =>
      request<any>(`/schedules/${scheduleId}/complete`, { method: 'POST', body: JSON.stringify({ notes }) }),
    cancel: (scheduleId: number) =>
      request<any>(`/schedules/${scheduleId}/cancel`, { method: 'POST' }),
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

  payments: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/payments${qs}`);
    },
    get: (id: number) => request<any>(`/payments/${id}`),
    create: (data: {
      rental_id?: number;
      client_id: number;
      payment_type: 'advance' | 'monthly' | 'credit_adjustment';
      payment_method: 'upi' | 'neft' | 'cash' | 'cheque' | 'bank_transfer';
      amount: number;
      payment_date: string;
      notes?: string;
      bulk_id?: string;
    }) => request<any>('/payments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    clientBalance: (clientId: number) =>
      request<any>(`/payments/client/${clientId}/balance`),
    clientPayments: (clientId: number, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/payments?client_id=${clientId}${qs ? '&' + qs.slice(1) : ''}`);
    },
    rentalSummary: (rentalId: number) =>
      request<any>(`/payments/rental/${rentalId}/summary`),
  },

  creditNotes: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/credit-notes${qs}`);
    },
    get: (id: number) => request<any>(`/credit-notes/${id}`),
    create: (rentalId: number, data: { advance_paid: number; resolution?: string; notes?: string }) =>
      request<any>(`/rentals/${rentalId}/credit-note`, { method: 'POST', body: JSON.stringify(data) }),
    send: (id: number) =>
      request<any>(`/credit-notes/${id}/send`, { method: 'POST' }),
    resolve: (id: number, data: { resolution: string; notes?: string }) =>
      request<any>(`/credit-notes/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  exchanges: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/exchanges${qs}`);
    },
    get: (id: number) => request<any>(`/exchanges/${id}`),
    create: (data: {
      rental_id: number;
      new_inventory_id: number;
      exchange_date: string;
      reason?: string;
      notes?: string;
    }) => request<any>('/exchanges', { method: 'POST', body: JSON.stringify(data) }),
    myExchanges: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/client/exchanges${qs}`);
    },
  },

  dashboard: {
    summary: () => request<any>('/dashboard/summary'),
  },
};
