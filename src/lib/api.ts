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

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const isHtmlResponse = response.headers.get('content-type')?.includes('text/html');

    if (response.status === 404 || response.status === 405 || response.status === 501 || isHtmlResponse) {
      // Endpoint not supported on server (e.g. running on Cloudflare Workers / static hosting without Express backend)
      return handleClientFallback<T>(endpoint, options, token);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (data && data.error) {
        throw new Error(data.error);
      }
      // If server returned non-200 without standard JSON error (e.g. CDN error page)
      return handleClientFallback<T>(endpoint, options, token);
    }

    return data as T;
  } catch (err: any) {
    // If it's a known user-facing error message thrown intentionally, rethrow it
    if (
      err.message &&
      !err.message.includes('Failed to fetch') &&
      !err.message.includes('NetworkError') &&
      !err.message.includes('status 404') &&
      !err.message.includes('status 405') &&
      !err.message.includes('status 500') &&
      !err.message.includes('Request failed')
    ) {
      throw err;
    }
    // Network failure or static host fallback
    return handleClientFallback<T>(endpoint, options, token);
  }
}

// Client-side local storage engine for Cloudflare Workers / static deployments
const DB_STORAGE_KEY = 'invoice_tracker_client_db_v1';

interface ClientDB {
  users: User[];
  passwords: Record<string, string>;
  entries: Entry[];
  auditLogs: AuditLog[];
  correctionRequests: CorrectionRequest[];
  passwordResetRequests: PasswordResetRequest[];
  config: { spreadsheetId: string; clientEmail: string; privateKey: string };
}

function getClientDB(): ClientDB {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // fallback to seed
  }

  const seed: ClientDB = {
    users: [
      {
        id: 'usr_admin_001',
        username: 'admin',
        name: 'System Administrator',
        role: 'admin',
        must_reset_password: false,
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_member_002',
        username: 'johndoe',
        name: 'John Doe',
        role: 'user',
        must_reset_password: false,
        is_active: true,
        created_by: 'admin',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ],
    passwords: {
      usr_admin_001: 'Admin@1234',
      usr_member_002: 'User@1234',
    },
    entries: [
      {
        id: 'ent_1001',
        invoice_date: '2026-08-01',
        invoice_number: 'INV-2026-0891',
        vendor_name: 'Apex Logistics Inc',
        customer_name: 'Acme Retail Corp',
        issue_description: 'Freight charge mismatch on invoice line item 3 ($450 discrepancy).',
        submitted_by_id: 'usr_member_002',
        submitted_by_name: 'John Doe',
        submitted_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        status: 'active',
      },
      {
        id: 'ent_1002',
        invoice_date: '2026-08-03',
        invoice_number: 'BILL-88321',
        vendor_name: 'Global Paper Supplies',
        customer_name: 'JM Jain LLP',
        issue_description: 'Missing tax ID on tax invoice copy; customer requesting revised tax credit memo.',
        submitted_by_id: 'usr_member_002',
        submitted_by_name: 'John Doe',
        submitted_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        status: 'active',
      },
    ],
    auditLogs: [],
    correctionRequests: [],
    passwordResetRequests: [],
    config: {
      spreadsheetId: '1aPGUbvtw_aMifaQ8yAZwBtu57HZZg7TX78-UFX6r5fE',
      clientEmail: 'ais-gemini-key-3f4bb5359c5e446@855232974817.iam.gserviceaccount.com',
      privateKey: '',
    },
  };

  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveClientDB(db: ClientDB) {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    if (db.config.privateKey) {
      performDirectClientSheetsSync(db).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save local client DB', e);
  }
}

async function getGoogleAccessToken(clientEmail: string, rawPrivateKeyStr: string): Promise<string> {
  let pem = rawPrivateKeyStr.replace(/\\n/g, '\n').trim();

  if (pem.startsWith('{')) {
    try {
      const parsed = JSON.parse(pem);
      if (parsed.client_email) clientEmail = parsed.client_email;
      if (parsed.private_key) pem = parsed.private_key.replace(/\\n/g, '\n').trim();
    } catch (e) {
      // ignore
    }
  }

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';

  let base64 = pem;
  if (base64.includes(pemHeader)) {
    base64 = base64.substring(base64.indexOf(pemHeader) + pemHeader.length);
  }
  if (base64.includes(pemFooter)) {
    base64 = base64.substring(0, base64.indexOf(pemFooter));
  }

  base64 = base64.replace(/\s+/g, '');

  if (!base64) {
    throw new Error('Invalid Service Account Private Key format.');
  }

  const binaryDerString = atob(base64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await window.crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  function base64url(arr: Uint8Array | string) {
    let str = typeof arr === 'string' ? btoa(arr) : btoa(String.fromCharCode(...new Uint8Array(arr)));
    return str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;

  const signature = await window.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedJwt)
  );

  const signedJwt = `${unsignedJwt}.${base64url(new Uint8Array(signature))}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) {
    throw new Error(
      tokenData.error_description || tokenData.error || 'Failed to authenticate service account with Google OAuth2'
    );
  }

  return tokenData.access_token;
}

async function performDirectClientSheetsSync(db: ClientDB): Promise<{ success: boolean; message: string; rowsSynced: number }> {
  const spreadsheetId = db.config.spreadsheetId || '1aPGUbvtw_aMifaQ8yAZwBtu57HZZg7TX78-UFX6r5fE';
  const clientEmail = db.config.clientEmail || 'ais-gemini-key-3f4bb5359c5e446@855232974817.iam.gserviceaccount.com';
  const privateKey = db.config.privateKey;

  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is not configured.');
  }

  if (!privateKey) {
    throw new Error('Google Sheets Private Key is required. Please open "Sheets Setup" in the header, paste your Service Account Private Key or raw JSON key, and click Save.');
  }

  const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
  let totalRows = 0;

  async function updateSheetTab(tabName: string, headers: string[], rows: any[][]) {
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A1:Z10000:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A1?valueInputOption=USER_ENTERED`;
    const updateResp = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [headers, ...rows],
      }),
    });

    if (!updateResp.ok) {
      const errJson = await updateResp.json().catch(() => ({}));
      if (updateResp.status === 403 || errJson.error?.status === 'PERMISSION_DENIED') {
        throw new Error(`Google Sheets Access Permission Error: The Service Account (${clientEmail}) does not have permission to write to Google Spreadsheet (${spreadsheetId}). Please open your Google Sheet, click the top-right 'Share' button, and add '${clientEmail}' as an Editor.`);
      }
      throw new Error(errJson.error?.message || `Failed to update tab ${tabName} in Google Sheets`);
    }
  }

  // 1. Users Tab
  const userHeaders = ['id', 'username', 'name', 'role', 'must_reset_password', 'is_active', 'created_by', 'created_at'];
  const userRows = db.users.map(u => [
    u.id, u.username, u.name, u.role, u.must_reset_password ? 'true' : 'false', u.is_active ? 'true' : 'false', u.created_by, u.created_at
  ]);
  await updateSheetTab('Users', userHeaders, userRows);
  totalRows += userRows.length;

  // 2. Entries Tab
  const entryHeaders = ['id', 'invoice_date', 'invoice_number', 'vendor_name', 'customer_name', 'issue_description', 'submitted_by_id', 'submitted_by_name', 'submitted_at', 'status'];
  const entryRows = db.entries.map(e => [
    e.id, e.invoice_date, e.invoice_number, e.vendor_name, e.customer_name, e.issue_description, e.submitted_by_id, e.submitted_by_name, e.submitted_at, e.status
  ]);
  await updateSheetTab('Entries', entryHeaders, entryRows);
  totalRows += entryRows.length;

  // 3. AuditLog Tab
  const auditHeaders = ['id', 'entry_id', 'admin_id', 'admin_name', 'action', 'reason', 'created_at'];
  const auditRows = db.auditLogs.map(a => [
    a.id, a.entry_id, a.admin_id, a.admin_name || '', a.action, a.reason, a.created_at
  ]);
  await updateSheetTab('AuditLog', auditHeaders, auditRows);
  totalRows += auditRows.length;

  // 4. CorrectionRequests Tab
  const corrHeaders = ['id', 'entry_id', 'requested_by_id', 'request_details', 'status', 'admin_response', 'resolved_by_id', 'created_at', 'resolved_at'];
  const corrRows = db.correctionRequests.map(r => [
    r.id, r.entry_id, r.requested_by_id, r.request_details, r.status, r.admin_response || '', r.resolved_by_id || '', r.created_at, r.resolved_at || ''
  ]);
  await updateSheetTab('CorrectionRequests', corrHeaders, corrRows);
  totalRows += corrRows.length;

  // 5. PasswordResetRequests Tab
  const resetHeaders = ['id', 'username', 'user_id', 'status', 'resolved_by_id', 'created_at', 'resolved_at'];
  const resetRows = db.passwordResetRequests.map(p => [
    p.id, p.username, p.user_id || '', p.status, p.resolved_by_id || '', p.created_at, p.resolved_at || ''
  ]);
  await updateSheetTab('PasswordResetRequests', resetHeaders, resetRows);
  totalRows += resetRows.length;

  return {
    success: true,
    message: `Successfully transferred ${totalRows} data rows across all 5 sheets in Google Spreadsheet ID ${spreadsheetId}.`,
    rowsSynced: totalRows,
  };
}

async function handleClientFallback<T>(endpoint: string, options: RequestInit, token: string | null): Promise<T> {
  const db = getClientDB();
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body as string) : {};

  // Current logged in user helper
  let currentUser: User | null = null;
  if (token && token.startsWith('mock_token_')) {
    const uid = token.replace('mock_token_', '');
    currentUser = db.users.find((u) => u.id === uid) || null;
  }

  // 1. Auth Login
  if (endpoint === '/api/auth/login' && method === 'POST') {
    const { username, password } = body;
    const cleanUserStr = (username || '').trim().toLowerCase();
    
    // Support matching 'admin', 'johndoe', or 'member'
    const user = db.users.find(
      (u) =>
        u.username.toLowerCase() === cleanUserStr ||
        (cleanUserStr === 'member' && u.id === 'usr_member_002')
    );

    if (!user) {
      throw new Error('Invalid username or password');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated. Please contact an administrator.');
    }

    const storedPass = db.passwords[user.id] || 'Admin@1234';
    if (storedPass !== password) {
      throw new Error('Invalid username or password');
    }

    const newToken = `mock_token_${user.id}`;
    setStoredToken(newToken);
    return { user, token: newToken } as T;
  }

  // 2. Auth Me
  if (endpoint === '/api/auth/me' && method === 'GET') {
    if (!currentUser) {
      throw new Error('Not authenticated');
    }
    return { user: currentUser } as T;
  }

  // 3. Auth Logout
  if (endpoint === '/api/auth/logout' && method === 'POST') {
    clearStoredToken();
    return { success: true } as T;
  }

  // 4. Auth Change Password
  if (endpoint === '/api/auth/change-password' && method === 'POST') {
    if (!currentUser) throw new Error('Not authenticated');
    db.passwords[currentUser.id] = body.newPassword;
    const uIdx = db.users.findIndex((u) => u.id === currentUser!.id);
    if (uIdx !== -1) {
      db.users[uIdx].must_reset_password = false;
    }
    saveClientDB(db);
    return { success: true, user: db.users[uIdx], message: 'Password updated successfully' } as T;
  }

  // 5. Auth Request Password Reset
  if (endpoint === '/api/auth/request-password-reset' && method === 'POST') {
    const { username } = body;
    const user = db.users.find((u) => u.username.toLowerCase() === (username || '').trim().toLowerCase());
    const newReq: PasswordResetRequest = {
      id: `reset_${Date.now()}`,
      username: username.trim(),
      user_id: user?.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    db.passwordResetRequests.unshift(newReq);
    saveClientDB(db);
    return { success: true, message: 'Password reset request submitted to administrator.' } as T;
  }

  // 6. Admin Users List
  if (endpoint === '/api/admin/users' && method === 'GET') {
    return { users: db.users } as T;
  }

  // 7. Admin Create User
  if (endpoint === '/api/admin/users' && method === 'POST') {
    const { username, name, role } = body;
    const newId = `usr_${Date.now()}`;
    const newUser: User = {
      id: newId,
      username: username.trim().toLowerCase(),
      name: name.trim(),
      role: role || 'user',
      must_reset_password: true,
      is_active: true,
      created_by: currentUser?.name || 'admin',
      created_at: new Date().toISOString(),
    };
    db.users.push(newUser);
    db.passwords[newId] = 'TempPass123!';
    saveClientDB(db);
    return { user: newUser, tempPassword: 'TempPass123!', message: 'User created successfully' } as T;
  }

  // 8. Admin Update User
  if (endpoint.startsWith('/api/admin/users/') && method === 'PATCH') {
    const userId = endpoint.split('/')[4];
    const uIdx = db.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('User not found');

    if (body.role) db.users[uIdx].role = body.role;
    if (typeof body.is_active === 'boolean') db.users[uIdx].is_active = body.is_active;

    let tempPassword;
    if (body.resetPassword) {
      tempPassword = 'TempPass123!';
      db.passwords[userId] = tempPassword;
      db.users[uIdx].must_reset_password = true;
    }

    saveClientDB(db);
    return { user: db.users[uIdx], tempPassword, message: 'User updated successfully' } as T;
  }

  // 9. Admin Password Reset Requests
  if (endpoint === '/api/admin/password-reset-requests' && method === 'GET') {
    return { requests: db.passwordResetRequests } as T;
  }

  // 10. Admin Resolve Password Reset
  if (endpoint.startsWith('/api/admin/password-reset-requests/') && method === 'PATCH') {
    const reqId = endpoint.split('/')[4];
    const rIdx = db.passwordResetRequests.findIndex((r) => r.id === reqId);
    if (rIdx === -1) throw new Error('Reset request not found');

    db.passwordResetRequests[rIdx].status = 'resolved';
    db.passwordResetRequests[rIdx].resolved_by_id = currentUser?.id;
    db.passwordResetRequests[rIdx].resolved_by_name = currentUser?.name;
    db.passwordResetRequests[rIdx].resolved_at = new Date().toISOString();

    const targetUserId = db.passwordResetRequests[rIdx].user_id;
    const tempPassword = 'TempPass123!';
    if (targetUserId) {
      db.passwords[targetUserId] = tempPassword;
      const uIdx = db.users.findIndex((u) => u.id === targetUserId);
      if (uIdx !== -1) db.users[uIdx].must_reset_password = true;
    }

    saveClientDB(db);
    return { request: db.passwordResetRequests[rIdx], tempPassword, message: 'Password reset resolved' } as T;
  }

  // 11. Create Entry
  if (endpoint === '/api/entries' && method === 'POST') {
    const newEntry: Entry = {
      id: `ent_${Date.now()}`,
      invoice_date: body.invoice_date,
      invoice_number: body.invoice_number,
      vendor_name: body.vendor_name,
      customer_name: body.customer_name,
      issue_description: body.issue_description,
      submitted_by_id: currentUser?.id || 'usr_member_002',
      submitted_by_name: currentUser?.name || 'John Doe',
      submitted_at: new Date().toISOString(),
      status: 'active',
    };
    db.entries.unshift(newEntry);

    const log: AuditLog = {
      id: `aud_${Date.now()}`,
      entry_id: newEntry.id,
      admin_id: currentUser?.id || 'system',
      admin_name: currentUser?.name || 'User',
      action: 'edit',
      before_snapshot: '',
      after_snapshot: JSON.stringify(newEntry),
      reason: 'Initial submission',
      created_at: new Date().toISOString(),
    };
    db.auditLogs.unshift(log);
    saveClientDB(db);
    return { entry: newEntry, message: 'Invoice issue logged successfully' } as T;
  }

  // 12. Get Entries
  if (endpoint.startsWith('/api/entries') && method === 'GET') {
    const url = new URL(endpoint, 'http://localhost');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const vendorName = url.searchParams.get('vendorName');
    const customerName = url.searchParams.get('customerName');

    let filtered = db.entries.filter((e) => (includeDeleted ? true : e.status === 'active'));
    if (vendorName) {
      filtered = filtered.filter((e) => e.vendor_name.toLowerCase().includes(vendorName.toLowerCase()));
    }
    if (customerName) {
      filtered = filtered.filter((e) => e.customer_name.toLowerCase().includes(customerName.toLowerCase()));
    }

    return { entries: filtered } as T;
  }

  // 13. Audit logs for entry
  if (endpoint.includes('/audit') && method === 'GET') {
    const entryId = endpoint.split('/')[3];
    const logs = db.auditLogs.filter((a) => a.entry_id === entryId);
    return { auditLogs: logs } as T;
  }

  // 14. Update Entry
  if (endpoint.startsWith('/api/entries/') && method === 'PATCH') {
    const entryId = endpoint.split('/')[3];
    const eIdx = db.entries.findIndex((e) => e.id === entryId);
    if (eIdx === -1) throw new Error('Entry not found');

    const beforeSnapshot = JSON.stringify(db.entries[eIdx]);
    if (body.invoice_date) db.entries[eIdx].invoice_date = body.invoice_date;
    if (body.invoice_number) db.entries[eIdx].invoice_number = body.invoice_number;
    if (body.vendor_name) db.entries[eIdx].vendor_name = body.vendor_name;
    if (body.customer_name) db.entries[eIdx].customer_name = body.customer_name;
    if (body.issue_description) db.entries[eIdx].issue_description = body.issue_description;

    db.entries[eIdx].last_edited_at = new Date().toISOString();
    db.entries[eIdx].last_edited_by = currentUser?.name || 'Admin';

    const log: AuditLog = {
      id: `aud_${Date.now()}`,
      entry_id: entryId,
      admin_id: currentUser?.id || 'admin',
      admin_name: currentUser?.name || 'Admin',
      action: 'edit',
      before_snapshot: beforeSnapshot,
      after_snapshot: JSON.stringify(db.entries[eIdx]),
      reason: body.reason || 'Admin edit',
      correction_request_id: body.correction_request_id,
      created_at: new Date().toISOString(),
    };
    db.auditLogs.unshift(log);
    saveClientDB(db);
    return { entry: db.entries[eIdx], auditLog: log, message: 'Entry updated successfully' } as T;
  }

  // 15. Delete Entry
  if (endpoint.startsWith('/api/entries/') && method === 'DELETE') {
    const entryId = endpoint.split('/')[3];
    const eIdx = db.entries.findIndex((e) => e.id === entryId);
    if (eIdx === -1) throw new Error('Entry not found');

    const beforeSnapshot = JSON.stringify(db.entries[eIdx]);
    db.entries[eIdx].status = 'deleted';

    const log: AuditLog = {
      id: `aud_${Date.now()}`,
      entry_id: entryId,
      admin_id: currentUser?.id || 'admin',
      admin_name: currentUser?.name || 'Admin',
      action: 'delete',
      before_snapshot: beforeSnapshot,
      after_snapshot: '',
      reason: body.reason || 'Deleted by admin',
      created_at: new Date().toISOString(),
    };
    db.auditLogs.unshift(log);
    saveClientDB(db);
    return { entry: db.entries[eIdx], auditLog: log, message: 'Entry deleted successfully' } as T;
  }

  // 16. Restore Entry
  if (endpoint.includes('/restore') && method === 'POST') {
    const entryId = endpoint.split('/')[3];
    const eIdx = db.entries.findIndex((e) => e.id === entryId);
    if (eIdx === -1) throw new Error('Entry not found');

    db.entries[eIdx].status = 'active';
    const log: AuditLog = {
      id: `aud_${Date.now()}`,
      entry_id: entryId,
      admin_id: currentUser?.id || 'admin',
      admin_name: currentUser?.name || 'Admin',
      action: 'restore',
      before_snapshot: '',
      after_snapshot: JSON.stringify(db.entries[eIdx]),
      reason: body.reason || 'Restored by admin',
      created_at: new Date().toISOString(),
    };
    db.auditLogs.unshift(log);
    saveClientDB(db);
    return { entry: db.entries[eIdx], auditLog: log, message: 'Entry restored successfully' } as T;
  }

  // 17. Create Correction Request
  if (endpoint.includes('/correction-request') && method === 'POST') {
    const entryId = endpoint.split('/')[3];
    const entry = db.entries.find((e) => e.id === entryId);

    const newReq: CorrectionRequest = {
      id: `corr_${Date.now()}`,
      entry_id: entryId,
      entry_invoice_number: entry?.invoice_number,
      entry_vendor_name: entry?.vendor_name,
      requested_by_id: currentUser?.id || 'usr_member_002',
      requested_by_name: currentUser?.name || 'User',
      request_details: body.request_details,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    db.correctionRequests.unshift(newReq);
    saveClientDB(db);
    return { correctionRequest: newReq, message: 'Correction request submitted to admin.' } as T;
  }

  // 18. Correction Requests (Mine)
  if (endpoint === '/api/correction-requests/mine' && method === 'GET') {
    const mine = db.correctionRequests.filter((r) => r.requested_by_id === currentUser?.id);
    return { requests: mine } as T;
  }

  // 19. Correction Requests (All)
  if (endpoint === '/api/correction-requests' && method === 'GET') {
    return { requests: db.correctionRequests } as T;
  }

  // 20. Update Correction Request
  if (endpoint.startsWith('/api/correction-requests/') && method === 'PATCH') {
    const reqId = endpoint.split('/')[3];
    const rIdx = db.correctionRequests.findIndex((r) => r.id === reqId);
    if (rIdx === -1) throw new Error('Correction request not found');

    db.correctionRequests[rIdx].status = body.status;
    db.correctionRequests[rIdx].admin_response = body.admin_response;
    db.correctionRequests[rIdx].resolved_by_id = currentUser?.id;
    db.correctionRequests[rIdx].resolved_by_name = currentUser?.name;
    db.correctionRequests[rIdx].resolved_at = new Date().toISOString();

    if (body.status === 'actioned' && body.updatedEntryFields) {
      const eIdx = db.entries.findIndex((e) => e.id === db.correctionRequests[rIdx].entry_id);
      if (eIdx !== -1) {
        Object.assign(db.entries[eIdx], body.updatedEntryFields);
      }
    }

    saveClientDB(db);
    return { correctionRequest: db.correctionRequests[rIdx], message: 'Correction request updated' } as T;
  }

  // 21. Dashboard Summary
  if (endpoint === '/api/dashboard/summary' && method === 'GET') {
    const active = db.entries.filter((e) => e.status === 'active');
    const deleted = db.entries.filter((e) => e.status === 'deleted');
    const pendingCorr = db.correctionRequests.filter((r) => r.status === 'pending').length;

    // Top vendors
    const vendorCounts: Record<string, number> = {};
    active.forEach((e) => {
      vendorCounts[e.vendor_name] = (vendorCounts[e.vendor_name] || 0) + 1;
    });
    const topVendors = Object.entries(vendorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top customers
    const customerCounts: Record<string, number> = {};
    active.forEach((e) => {
      customerCounts[e.customer_name] = (customerCounts[e.customer_name] || 0) + 1;
    });
    const topCustomers = Object.entries(customerCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      summary: {
        totalIssues: db.entries.length,
        totalActiveIssues: active.length,
        totalDeletedIssues: deleted.length,
        pendingCorrectionRequests: pendingCorr,
        topVendors,
        topCustomers,
        trendData: [],
        recentEntries: active.slice(0, 5),
      },
    } as T;
  }

  // 22. Sheets Config
  if (endpoint === '/api/admin/sheets-config') {
    if (method === 'POST') {
      db.config.spreadsheetId = body.spreadsheetId || db.config.spreadsheetId;
      if (body.clientEmail) db.config.clientEmail = body.clientEmail;
      if (body.privateKey) {
        let pk = body.privateKey;
        if (pk.includes('{') && pk.includes('private_key')) {
          try {
            const parsed = JSON.parse(pk);
            if (parsed.client_email) db.config.clientEmail = parsed.client_email;
            if (parsed.private_key) pk = parsed.private_key;
          } catch (e) {}
        }
        db.config.privateKey = pk;
      }
      saveClientDB(db);
      return {
        config: {
          spreadsheetId: db.config.spreadsheetId,
          serviceAccountEmail: db.config.clientEmail,
          isConnected: !!db.config.spreadsheetId && !!db.config.privateKey,
          hasCredentials: !!db.config.privateKey,
        },
        message: 'Google Sheets configuration saved.',
      } as unknown as T;
    }
    return {
      config: {
        spreadsheetId: db.config.spreadsheetId,
        serviceAccountEmail: db.config.clientEmail,
        isConnected: !!db.config.spreadsheetId && !!db.config.privateKey,
        hasCredentials: !!db.config.privateKey,
      },
    } as unknown as T;
  }

  // 23. Sheets Sync All
  if (endpoint === '/api/admin/sheets-sync-all' && method === 'POST') {
    return (await performDirectClientSheetsSync(db)) as unknown as T;
  }

  throw new Error(`Fallback route not implemented: ${endpoint}`);
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
