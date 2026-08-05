/**
 * Invoice Issue Tracker - Shared Type Definitions
 */

export type Role = 'user' | 'admin';

export type EntryStatus = 'active' | 'deleted';

export type CorrectionStatus = 'pending' | 'actioned' | 'rejected';

export type ResetRequestStatus = 'pending' | 'resolved';

export type AuditAction = 'edit' | 'delete' | 'restore';

export interface User {
  id: string; // Firebase Auth UID / Unique User ID
  username: string;
  name: string;
  role: Role;
  must_reset_password: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface Entry {
  id: string;
  invoice_date: string;
  invoice_number: string;
  vendor_name: string;
  customer_name: string;
  issue_description: string;
  submitted_by_id: string;
  submitted_by_name: string;
  submitted_at: string;
  status: EntryStatus;
  last_edited_at?: string;
  last_edited_by?: string;
}

export interface AuditLog {
  id: string;
  entry_id: string;
  admin_id: string;
  admin_name?: string;
  action: AuditAction;
  before_snapshot: string; // JSON string of Entry
  after_snapshot: string;  // JSON string of Entry or empty
  reason: string;
  correction_request_id?: string;
  created_at: string;
}

export interface CorrectionRequest {
  id: string;
  entry_id: string;
  entry_invoice_number?: string;
  entry_vendor_name?: string;
  requested_by_id: string;
  requested_by_name?: string;
  request_details: string;
  status: CorrectionStatus;
  admin_response?: string;
  resolved_by_id?: string;
  resolved_by_name?: string;
  created_at: string;
  resolved_at?: string;
}

export interface PasswordResetRequest {
  id: string;
  username: string;
  user_id?: string;
  status: ResetRequestStatus;
  resolved_by_id?: string;
  resolved_by_name?: string;
  created_at: string;
  resolved_at?: string;
}

export interface DashboardSummary {
  totalIssues: number;
  totalActiveIssues: number;
  totalDeletedIssues: number;
  pendingCorrectionRequests: number;
  topVendors: { name: string; count: number }[];
  topCustomers: { name: string; count: number }[];
  trendData: { period: string; count: number }[];
  recentEntries: Entry[];
}

export interface SheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  isConnected: boolean;
  lastSyncTime?: string;
  hasCredentials: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
