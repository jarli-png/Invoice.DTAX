const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${url}`, { ...options, headers });
  
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  
  return res;
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  // Invoices
  getInvoices: async (status?: string) => {
    const url = status ? `/invoices?status=${status}` : '/invoices';
    const res = await fetchWithAuth(url);
    return res.json();
  },
  
  getInvoice: async (id: string) => {
    const res = await fetchWithAuth(`/invoices/${id}`);
    return res.json();
  },
  
  createInvoice: async (data: any) => {
    const res = await fetchWithAuth('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  
  sendInvoice: async (id: string) => {
    const res = await fetchWithAuth(`/invoices/${id}/send`, { method: 'POST' });
    return res.json();
  },
  
  getInvoicePdf: async (id: string) => {
    const res = await fetchWithAuth(`/invoices/${id}/pdf`);
    return res;
  },
  
  createCreditNote: async (id: string) => {
    const res = await fetchWithAuth(`/invoices/${id}/credit-note`, { method: 'POST' });
    return res.json();
  },

  // Customers
  getCustomers: async () => {
    const res = await fetchWithAuth('/customers');
    return res.json();
  },
  
  getCustomer: async (id: string) => {
    const res = await fetchWithAuth(`/customers/${id}`);
    return res.json();
  },
  
  createCustomer: async (data: any) => {
    const res = await fetchWithAuth('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  
  updateCustomer: async (id: string, data: any) => {
    const res = await fetchWithAuth(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  
  deleteCustomer: async (id: string) => {
    const res = await fetchWithAuth(`/customers/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Products
  getProducts: async () => {
    const res = await fetchWithAuth('/products');
    return res.json();
  },
  
  createProduct: async (data: any) => {
    const res = await fetchWithAuth('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  
  updateProduct: async (id: string, data: any) => {
    const res = await fetchWithAuth(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  
  deleteProduct: async (id: string) => {
    const res = await fetchWithAuth(`/products/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Organizations
  getOrganizations: async () => {
    const res = await fetchWithAuth('/organizations');
    return res.json();
  },
  
  getOrganization: async (id: string) => {
    const res = await fetchWithAuth(`/organizations/${id}`);
    return res.json();
  },
  
  updateOrganization: async (id: string, data: any) => {
    const res = await fetchWithAuth(`/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Payments
  getPayments: async () => {
    const res = await fetchWithAuth('/payments');
    return res.json();
  },
  
  registerPayment: async (data: any) => {
    const res = await fetchWithAuth('/payments/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Orders (from tax.salestext.no)
  getOrders: async () => {
    const res = await fetchWithAuth('/orders');
    return res.json();
  },
  
  getOrderStatus: async (sourceOrderId: string) => {
    const res = await fetchWithAuth(`/orders/status/${sourceOrderId}`);
    return res.json();
  },

  // Reports
  getRevenueReport: async (from: string, to: string) => {
    const res = await fetchWithAuth(`/reports/revenue?from=${from}&to=${to}`);
    return res.json();
  },
  
  getVatReport: async (period: string) => {
    const res = await fetchWithAuth(`/reports/vat?period=${period}`);
    return res.json();
  },
  
  getOutstandingReport: async () => {
    const res = await fetchWithAuth('/reports/outstanding');
    return res.json();
  },

  // Settings
  getSettings: async () => {
    const res = await fetchWithAuth('/settings');
    return res.json();
  },
  
  updateSettings: async (data: any) => {
    const res = await fetchWithAuth('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Audit logs
  getAuditLogs: async (limit = 50) => {
    const res = await fetchWithAuth(`/audit?limit=${limit}`);
    return res.json();
  },
};

export default api;
