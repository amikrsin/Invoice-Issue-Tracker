/**
 * Invoice Issue Tracker - Frontend API Client
 */

import {
  User,
  Entry,
  AuditLog,
  CorrectionRequest,
  PasswordResetRequest,
  DashboardSummary,
  SheetsConfig,
} from '../types';

const TOKEN_KEY = 'invoice_tracker_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  getMe: () =>
    request<{ user: User }>('/api/auth/me'),

  changePassword: (newPassword: string) =>
    request<{ success: boolean; user: User; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  requestPasswordReset: (username: string) =>
    request<{ success: boolean; message: string }>('/api/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  // Admin User Management
  getUsers: () =>
    request<{ users: User[] }>('/api/admin/users'),

  createUser: (username: string, name: string, role: 'user' | 'admin') =>
    request<{ user: User; tempPassword: string; message: string }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, name, role }),
    }),

  updateUser: (id: string, updates: { role?: 'user' | 'admin'; is_active?: boolean; resetPassword?: boolean }) =>
    request<{ user: User; tempPassword?: string; message: string }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Password Reset Requests (Admin)
  getPasswordResetRequests: () =>
    request<{ requests: PasswordResetRequest[] }>('/api/admin/password-reset-requests'),

  resolvePasswordResetRequest: (id: string) =>
    request<{ request: PasswordResetRequest; tempPassword: string; message: string }>(
      `/api/admin/password-reset-requests/${id}`,
      { method: 'PATCH' }
    ),

  // Entries
  createEntry: (data: {
    invoice_date: string;
    invoice_number: string;
    vendor_name: string;
    customer_name: string;
    issue_description: string;
  }) =>
    request<{ entry: Entry; message: string }>('/api/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEntries: (filters?: {
    includeDeleted?: boolean;
    startDate?: string;
    endDate?: string;
    vendorName?: string;
    customerName?: string;
    submittedBy?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.includeDeleted) params.append('includeDeleted', 'true');
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.vendorName) params.append('vendorName', filters.vendorName);
    if (filters?.customerName) params.append('customerName', filters.customerName);
    if (filters?.submittedBy) params.append('submittedBy', filters.submittedBy);

    const queryStr = params.toString();
    return request<{ entries: Entry[] }>(`/api/entries${queryStr ? `?${queryStr}` : ''}`);
  },

  getAuditLogsForEntry: (entryId: string) =>
    request<{ auditLogs: AuditLog[] }>(`/api/entries/${entryId}/audit`),

  updateEntry: (
    id: string,
    data: {
      invoice_date?: string;
      invoice_number?: string;
      vendor_name?: string;
      customer_name?: string;
      issue_description?: string;
      reason: string;
      correction_request_id?: string;
    }
  ) =>
    request<{ entry: Entry; auditLog: AuditLog; message: string }>(`/api/entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteEntry: (id: string, reason: string) =>
    request<{ entry: Entry; auditLog: AuditLog; message: string }>(`/api/entries/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  restoreEntry: (id: string, reason?: string) =>
    request<{ entry: Entry; auditLog: AuditLog; message: string }>(`/api/entries/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Correction Requests
  createCorrectionRequest: (entryId: string, request_details: string) =>
    request<{ correctionRequest: CorrectionRequest; message: string }>(
      `/api/entries/${entryId}/correction-request`,
      {
        method: 'POST',
        body: JSON.stringify({ request_details }),
      }
    ),

  getMyCorrectionRequests: () =>
    request<{ requests: CorrectionRequest[] }>('/api/correction-requests/mine'),

  getAllCorrectionRequests: () =>
    request<{ requests: CorrectionRequest[] }>('/api/correction-requests'),

  updateCorrectionRequest: (
    id: string,
    status: 'actioned' | 'rejected',
    admin_response: string,
    updatedEntryFields?: Partial<Entry>
  ) =>
    request<{ correctionRequest: CorrectionRequest; message: string }>(
      `/api/correction-requests/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, admin_response, updatedEntryFields }),
      }
    ),

  // Dashboard
  getDashboardSummary: () =>
    request<{ summary: DashboardSummary }>('/api/dashboard/summary'),

  // Sheets Config
  getSheetsConfig: () =>
    request<{ config: SheetsConfig }>('/api/admin/sheets-config'),

  updateSheetsConfig: (spreadsheetId: string, clientEmail?: string, privateKey?: string) =>
    request<{ config: SheetsConfig; message: string }>('/api/admin/sheets-config', {
      method: 'POST',
      body: JSON.stringify({ spreadsheetId, clientEmail, privateKey }),
    }),

  syncAllToSheets: () =>
    request<{ success: boolean; message: string; rowsSynced: number }>('/api/admin/sheets-sync-all', {
      method: 'POST',
    }),
};
