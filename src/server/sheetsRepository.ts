import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import {
  User,
  Entry,
  AuditLog,
  CorrectionRequest,
  PasswordResetRequest,
  SheetsConfig,
} from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_STORE_PATH = path.join(DATA_DIR, 'sheets_store.json');

// Memory cache & local fallback store structure
interface LocalStore {
  config: {
    spreadsheetId: string;
    clientEmail: string;
    privateKey: string;
  };
  users: User[];
  passwords: Record<string, string>; // user_id -> password hash/plain
  entries: Entry[];
  auditLogs: AuditLog[];
  correctionRequests: CorrectionRequest[];
  passwordResetRequests: PasswordResetRequest[];
}

// Initial seed data for out-of-the-box readiness
const defaultUsers: User[] = [
  {
    id: 'usr_admin_001',
    username: 'admin',
    name: 'System Administrator',
    role: 'admin',
    must_reset_password: true,
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
];

const defaultPasswords: Record<string, string> = {
  usr_admin_001: 'Admin@1234',
  usr_member_002: 'User@1234',
};

const defaultEntries: Entry[] = [
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
];

class SheetsRepository {
  private localStore: LocalStore;

  constructor() {
    this.localStore = this.loadLocalStore();
  }

  private loadLocalStore(): LocalStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(LOCAL_STORE_PATH)) {
        const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          config: parsed.config || { spreadsheetId: process.env.SPREADSHEET_ID || '', clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '', privateKey: process.env.GOOGLE_PRIVATE_KEY || '' },
          users: parsed.users && parsed.users.length ? parsed.users : defaultUsers,
          passwords: parsed.passwords || defaultPasswords,
          entries: parsed.entries && parsed.entries.length ? parsed.entries : defaultEntries,
          auditLogs: parsed.auditLogs || [],
          correctionRequests: parsed.correctionRequests || [],
          passwordResetRequests: parsed.passwordResetRequests || [],
        };
      }
    } catch (err) {
      console.error('Failed to load local store file:', err);
    }

    return {
      config: {
        spreadsheetId: process.env.SPREADSHEET_ID || '',
        clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
        privateKey: process.env.GOOGLE_PRIVATE_KEY || '',
      },
      users: defaultUsers,
      passwords: defaultPasswords,
      entries: defaultEntries,
      auditLogs: [],
      correctionRequests: [],
      passwordResetRequests: [],
    };
  }

  private saveLocalStore() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(this.localStore, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save local store file:', err);
    }
  }

  public async exportAllToGoogleSheets(): Promise<{ success: boolean; message: string; rowsSynced: number }> {
    const sheets = this.getGoogleSheetsClient();
    const spreadsheetId = this.localStore.config.spreadsheetId || '1aPGUbvtw_aMifaQ8yAZwBtu57HZZg7TX78-UFX6r5fE';
    const clientEmail = this.localStore.config.clientEmail || 'ais-gemini-key-3f4bb5359c5e446@855232974817.iam.gserviceaccount.com';

    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is not configured.');
    }
    if (!sheets) {
      throw new Error('Google Sheets Service Account credentials are missing. Please paste your Service Account Private Key or entire JSON key into the "Google Sheets Connection" modal and click Save.');
    }

    try {
      let totalRows = 0;

      // 1. Users Tab
      const userHeaders = ['id', 'username', 'name', 'role', 'must_reset_password', 'is_active', 'created_by', 'created_at'];
      const userRows = this.localStore.users.map(u => [
        u.id,
        u.username,
        u.name,
        u.role,
        u.must_reset_password ? 'true' : 'false',
        u.is_active ? 'true' : 'false',
        u.created_by,
        u.created_at
      ]);
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Users!A1:Z1000' }).catch(() => {});
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Users!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [userHeaders, ...userRows] }
      });
      totalRows += userRows.length;

      // 2. Entries Tab
      const entryHeaders = ['id', 'invoice_date', 'invoice_number', 'vendor_name', 'customer_name', 'issue_description', 'submitted_by_id', 'submitted_by_name', 'submitted_at', 'status'];
      const entryRows = this.localStore.entries.map(e => [
        e.id,
        e.invoice_date,
        e.invoice_number,
        e.vendor_name,
        e.customer_name,
        e.issue_description,
        e.submitted_by_id,
        e.submitted_by_name,
        e.submitted_at,
        e.status
      ]);
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Entries!A1:Z10000' }).catch(() => {});
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Entries!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [entryHeaders, ...entryRows] }
      });
      totalRows += entryRows.length;

      // 3. AuditLog Tab
      const auditHeaders = ['id', 'entry_id', 'admin_id', 'admin_name', 'action', 'reason', 'created_at'];
      const auditRows = this.localStore.auditLogs.map(a => [
        a.id,
        a.entry_id,
        a.admin_id,
        a.admin_name || '',
        a.action,
        a.reason,
        a.created_at
      ]);
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'AuditLog!A1:Z10000' }).catch(() => {});
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'AuditLog!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [auditHeaders, ...auditRows] }
      });
      totalRows += auditRows.length;

      // 4. CorrectionRequests Tab
      const corrHeaders = ['id', 'entry_id', 'requested_by_id', 'request_details', 'status', 'admin_response', 'resolved_by_id', 'created_at', 'resolved_at'];
      const corrRows = this.localStore.correctionRequests.map(r => [
        r.id,
        r.entry_id,
        r.requested_by_id,
        r.request_details,
        r.status,
        r.admin_response || '',
        r.resolved_by_id || '',
        r.created_at,
        r.resolved_at || ''
      ]);
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'CorrectionRequests!A1:Z10000' }).catch(() => {});
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'CorrectionRequests!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [corrHeaders, ...corrRows] }
      });
      totalRows += corrRows.length;

      // 5. PasswordResetRequests Tab
      const resetHeaders = ['id', 'username', 'user_id', 'status', 'resolved_by_id', 'created_at', 'resolved_at'];
      const resetRows = this.localStore.passwordResetRequests.map(p => [
        p.id,
        p.username,
        p.user_id || '',
        p.status,
        p.resolved_by_id || '',
        p.created_at,
        p.resolved_at || ''
      ]);
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'PasswordResetRequests!A1:Z10000' }).catch(() => {});
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'PasswordResetRequests!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [resetHeaders, ...resetRows] }
      });
      totalRows += resetRows.length;

      return {
        success: true,
        message: `Successfully transferred ${totalRows} data rows across all 5 sheets in Google Spreadsheet ID ${spreadsheetId}.`,
        rowsSynced: totalRows,
      };
    } catch (err: any) {
      if (err.message?.includes('caller does not have permission') || err.code === 403) {
        throw new Error(`Google Sheets Access Permission Error: The Service Account (${clientEmail}) does not have permission to write to Google Spreadsheet (${spreadsheetId}). Please open your Google Sheet, click the top-right 'Share' button, and add '${clientEmail}' as an Editor.`);
      }
      throw err;
    }
  }

  public getSheetsConfig(): SheetsConfig {
    const { spreadsheetId, clientEmail } = this.localStore.config;
    const finalSpreadsheetId = spreadsheetId || process.env.SPREADSHEET_ID || '1aPGUbvtw_aMifaQ8yAZwBtu57HZZg7TX78-UFX6r5fE';
    const hasCredentials = Boolean((clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) && (this.localStore.config.privateKey || process.env.GOOGLE_PRIVATE_KEY));
    return {
      spreadsheetId: finalSpreadsheetId,
      serviceAccountEmail: clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'service-account@project.iam.gserviceaccount.com',
      isConnected: Boolean(finalSpreadsheetId && hasCredentials),
      hasCredentials,
    };
  }

  public updateSheetsConfig(spreadsheetId: string, clientEmail?: string, privateKey?: string) {
    this.localStore.config.spreadsheetId = spreadsheetId.trim();

    // Auto-parse if user pasted raw JSON key in either privateKey or clientEmail
    const rawInput = (privateKey || clientEmail || '').trim();
    if (rawInput.startsWith('{') && rawInput.endsWith('}')) {
      try {
        const parsed = JSON.parse(rawInput);
        if (parsed.client_email) this.localStore.config.clientEmail = parsed.client_email.trim();
        if (parsed.private_key) this.localStore.config.privateKey = parsed.private_key.trim();
      } catch (e) {
        // Fallback to direct assignment
      }
    } else {
      if (clientEmail !== undefined) this.localStore.config.clientEmail = clientEmail.trim();
      if (privateKey !== undefined) this.localStore.config.privateKey = privateKey.trim();
    }

    this.saveLocalStore();
  }

  private getGoogleSheetsClient() {
    const { clientEmail, privateKey } = this.localStore.config;
    const key = (privateKey || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const email = clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!email || !key) return null;

    try {
      const auth = new google.auth.JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return google.sheets({ version: 'v4', auth });
    } catch (e) {
      console.error('Failed to initialize Google Sheets client:', e);
      return null;
    }
  }

  // Sync to Google Sheets if configured
  private async syncAppendToSheet(tabName: string, rowValues: any[]) {
    const sheets = this.getGoogleSheetsClient();
    const spreadsheetId = this.localStore.config.spreadsheetId;
    if (!sheets || !spreadsheetId) return;

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues.map(val => (val === undefined || val === null ? '' : String(val)))],
        },
      });
    } catch (e) {
      console.error(`Google Sheets syncAppend error on tab ${tabName}:`, e);
    }
  }

  private async syncUpdateCellRange(tabName: string, rowIndexOneBased: number, rowValues: any[]) {
    const sheets = this.getGoogleSheetsClient();
    const spreadsheetId = this.localStore.config.spreadsheetId;
    if (!sheets || !spreadsheetId) return;

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A${rowIndexOneBased}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowValues.map(val => (val === undefined || val === null ? '' : String(val)))],
        },
      });
    } catch (e) {
      console.error(`Google Sheets syncUpdate error on tab ${tabName}:`, e);
    }
  }

  // Tab 1: Users
  public async getUsers(): Promise<User[]> {
    return [...this.localStore.users];
  }

  public async getUserById(id: string): Promise<User | undefined> {
    return this.localStore.users.find(u => u.id === id);
  }

  public async getUserByUsername(username: string): Promise<User | undefined> {
    const cleanUsername = username.trim().toLowerCase();
    return this.localStore.users.find(u => u.username.toLowerCase() === cleanUsername);
  }

  public async createUser(user: User, passwordHashOrPlain: string): Promise<User> {
    this.localStore.users.push(user);
    this.localStore.passwords[user.id] = passwordHashOrPlain;
    this.saveLocalStore();

    // Append to Users tab in Google Sheet:
    // id | username | name | role | must_reset_password | is_active | created_by | created_at
    const row = [
      user.id,
      user.username,
      user.name,
      user.role,
      user.must_reset_password ? 'true' : 'false',
      user.is_active ? 'true' : 'false',
      user.created_by,
      user.created_at,
    ];
    await this.syncAppendToSheet('Users', row);

    return user;
  }

  public async updateUser(
    id: string,
    updates: Partial<User> & { password?: string }
  ): Promise<User | null> {
    const index = this.localStore.users.findIndex(u => u.id === id);
    if (index === -1) return null;

    const existing = this.localStore.users[index];
    if (updates.password) {
      this.localStore.passwords[id] = updates.password;
    }

    const updatedUser: User = {
      ...existing,
      name: updates.name !== undefined ? updates.name : existing.name,
      role: updates.role !== undefined ? updates.role : existing.role,
      must_reset_password: updates.must_reset_password !== undefined ? updates.must_reset_password : existing.must_reset_password,
      is_active: updates.is_active !== undefined ? updates.is_active : existing.is_active,
    };

    this.localStore.users[index] = updatedUser;
    this.saveLocalStore();

    // Update row in Google Sheet (Header row is 1, so index 0 is row 2)
    const rowNumber = index + 2;
    const row = [
      updatedUser.id,
      updatedUser.username,
      updatedUser.name,
      updatedUser.role,
      updatedUser.must_reset_password ? 'true' : 'false',
      updatedUser.is_active ? 'true' : 'false',
      updatedUser.created_by,
      updatedUser.created_at,
    ];
    await this.syncUpdateCellRange('Users', rowNumber, row);

    return updatedUser;
  }

  public verifyPassword(userId: string, plainPassword: string): boolean {
    const stored = this.localStore.passwords[userId];
    return stored === plainPassword;
  }

  // Tab 2: Entries
  public async fetchEntriesFromSheet(): Promise<Entry[]> {
    const sheets = this.getGoogleSheetsClient();
    const spreadsheetId = this.localStore.config.spreadsheetId;
    if (!sheets || !spreadsheetId) return this.localStore.entries;

    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Entries!A2:Z10000',
      });
      const rows = res.data.values;
      if (rows && Array.isArray(rows)) {
        const fetchedEntries: Entry[] = [];
        rows.forEach((row, idx) => {
          if (!row || row.length < 3) return;
          const id = row[0] || `ent_sheet_${idx}`;
          const invoice_date = row[1] || new Date().toISOString().split('T')[0];
          const invoice_number = row[2] || '';
          const vendor_name = row[3] || '';
          const customer_name = row[4] || '';
          const issue_description = row[5] || '';
          const submitted_by_id = row[6] || 'external';
          const submitted_by_name = row[7] || 'External System';
          const submitted_at = row[8] || new Date().toISOString();
          const status = (row[9] as 'active' | 'deleted') || 'active';

          if (invoice_number) {
            fetchedEntries.push({
              id,
              invoice_date,
              invoice_number,
              vendor_name,
              customer_name,
              issue_description,
              submitted_by_id,
              submitted_by_name,
              submitted_at,
              status,
            });
          }
        });

        if (fetchedEntries.length > 0) {
          const map = new Map<string, Entry>();
          this.localStore.entries.forEach((e) => map.set(e.id, e));
          fetchedEntries.forEach((e) => map.set(e.id, e));

          const merged = Array.from(map.values());
          merged.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
          this.localStore.entries = merged;
          this.saveLocalStore();
        }
      }
    } catch (e) {
      console.warn('Failed to fetch entries from Google Sheets on server:', e);
    }

    return this.localStore.entries;
  }

  public async getEntries(includeDeleted = false): Promise<Entry[]> {
    await this.fetchEntriesFromSheet().catch(() => {});
    if (includeDeleted) {
      return [...this.localStore.entries];
    }
    return this.localStore.entries.filter(e => e.status === 'active');
  }

  public async getEntryById(id: string): Promise<Entry | undefined> {
    return this.localStore.entries.find(e => e.id === id);
  }

  public async createEntry(entry: Entry): Promise<Entry> {
    this.localStore.entries.unshift(entry);
    this.saveLocalStore();

    // Entries tab:
    // id | invoice_date | invoice_number | vendor_name | customer_name | issue_description | submitted_by_id | submitted_by_name | submitted_at | status | last_edited_at | last_edited_by
    const row = [
      entry.id,
      entry.invoice_date,
      entry.invoice_number,
      entry.vendor_name,
      entry.customer_name,
      entry.issue_description,
      entry.submitted_by_id,
      entry.submitted_by_name,
      entry.submitted_at,
      entry.status,
      entry.last_edited_at || '',
      entry.last_edited_by || '',
    ];
    await this.syncAppendToSheet('Entries', row);

    return entry;
  }

  public async updateEntry(
    id: string,
    updates: Partial<Entry>,
    adminId: string,
    adminName: string,
    reason: string,
    correctionRequestId?: string
  ): Promise<{ entry: Entry; auditLog: AuditLog } | null> {
    const index = this.localStore.entries.findIndex(e => e.id === id);
    if (index === -1) return null;

    const before = { ...this.localStore.entries[index] };
    const nowIso = new Date().toISOString();

    const after: Entry = {
      ...before,
      ...updates,
      id, // Immutable ID
      submitted_by_id: before.submitted_by_id, // Immutable original submitter
      submitted_by_name: before.submitted_by_name,
      submitted_at: before.submitted_at,
      last_edited_at: nowIso,
      last_edited_by: adminName,
    };

    this.localStore.entries[index] = after;

    // Create Audit Log record
    const auditLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      entry_id: id,
      admin_id: adminId,
      admin_name: adminName,
      action: updates.status === 'deleted' ? 'delete' : updates.status === 'active' && before.status === 'deleted' ? 'restore' : 'edit',
      before_snapshot: JSON.stringify(before),
      after_snapshot: JSON.stringify(after),
      reason,
      correction_request_id: correctionRequestId || '',
      created_at: nowIso,
    };

    this.localStore.auditLogs.unshift(auditLog);
    this.saveLocalStore();

    // Update cell range in Google Sheets
    // Find index in array (Header is row 1)
    const rowNumber = index + 2;
    const row = [
      after.id,
      after.invoice_date,
      after.invoice_number,
      after.vendor_name,
      after.customer_name,
      after.issue_description,
      after.submitted_by_id,
      after.submitted_by_name,
      after.submitted_at,
      after.status,
      after.last_edited_at || '',
      after.last_edited_by || '',
    ];
    await this.syncUpdateCellRange('Entries', rowNumber, row);

    // Append AuditLog row:
    // id | entry_id | admin_id | action | before_snapshot | after_snapshot | reason | correction_request_id | created_at
    const auditRow = [
      auditLog.id,
      auditLog.entry_id,
      auditLog.admin_id,
      auditLog.action,
      auditLog.before_snapshot,
      auditLog.after_snapshot,
      auditLog.reason,
      auditLog.correction_request_id || '',
      auditLog.created_at,
    ];
    await this.syncAppendToSheet('AuditLog', auditRow);

    return { entry: after, auditLog };
  }

  // Tab 3: AuditLog
  public async getAuditLogsForEntry(entryId: string): Promise<AuditLog[]> {
    return this.localStore.auditLogs.filter(a => a.entry_id === entryId);
  }

  public async getAllAuditLogs(): Promise<AuditLog[]> {
    return [...this.localStore.auditLogs];
  }

  // Tab 4: CorrectionRequests
  public async createCorrectionRequest(req: CorrectionRequest): Promise<CorrectionRequest> {
    this.localStore.correctionRequests.unshift(req);
    this.saveLocalStore();

    // CorrectionRequests tab:
    // id | entry_id | requested_by_id | request_details | status | admin_response | resolved_by_id | created_at | resolved_at
    const row = [
      req.id,
      req.entry_id,
      req.requested_by_id,
      req.request_details,
      req.status,
      req.admin_response || '',
      req.resolved_by_id || '',
      req.created_at,
      req.resolved_at || '',
    ];
    await this.syncAppendToSheet('CorrectionRequests', row);

    return req;
  }

  public async getCorrectionRequests(userId?: string): Promise<CorrectionRequest[]> {
    if (userId) {
      return this.localStore.correctionRequests.filter(c => c.requested_by_id === userId);
    }
    return [...this.localStore.correctionRequests];
  }

  public async updateCorrectionRequest(
    id: string,
    status: 'actioned' | 'rejected',
    adminResponse: string,
    adminId: string,
    adminName: string
  ): Promise<CorrectionRequest | null> {
    const index = this.localStore.correctionRequests.findIndex(c => c.id === id);
    if (index === -1) return null;

    const existing = this.localStore.correctionRequests[index];
    const updated: CorrectionRequest = {
      ...existing,
      status,
      admin_response: adminResponse,
      resolved_by_id: adminId,
      resolved_by_name: adminName,
      resolved_at: new Date().toISOString(),
    };

    this.localStore.correctionRequests[index] = updated;
    this.saveLocalStore();

    const rowNumber = index + 2;
    const row = [
      updated.id,
      updated.entry_id,
      updated.requested_by_id,
      updated.request_details,
      updated.status,
      updated.admin_response || '',
      updated.resolved_by_id || '',
      updated.created_at,
      updated.resolved_at || '',
    ];
    await this.syncUpdateCellRange('CorrectionRequests', rowNumber, row);

    return updated;
  }

  // Tab 5: PasswordResetRequests
  public async createPasswordResetRequest(username: string): Promise<PasswordResetRequest> {
    const user = await this.getUserByUsername(username);
    const req: PasswordResetRequest = {
      id: `rst_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      username,
      user_id: user ? user.id : '',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    this.localStore.passwordResetRequests.unshift(req);
    this.saveLocalStore();

    // PasswordResetRequests tab:
    // id | username | user_id | status | resolved_by_id | created_at | resolved_at
    const row = [
      req.id,
      req.username,
      req.user_id || '',
      req.status,
      req.resolved_by_id || '',
      req.created_at,
      req.resolved_at || '',
    ];
    await this.syncAppendToSheet('PasswordResetRequests', row);

    return req;
  }

  public async getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
    return [...this.localStore.passwordResetRequests];
  }

  public async resolvePasswordResetRequest(
    requestId: string,
    tempPassword: string,
    adminId: string,
    adminName: string
  ): Promise<{ request: PasswordResetRequest; tempPassword: string } | null> {
    const index = this.localStore.passwordResetRequests.findIndex(r => r.id === requestId);
    if (index === -1) return null;

    const req = this.localStore.passwordResetRequests[index];
    const user = req.user_id ? await this.getUserById(req.user_id) : await this.getUserByUsername(req.username);

    if (!user) {
      throw new Error('Associated user account not found');
    }

    // Update user password & set must_reset_password = true
    await this.updateUser(user.id, {
      password: tempPassword,
      must_reset_password: true,
    });

    const updatedReq: PasswordResetRequest = {
      ...req,
      status: 'resolved',
      resolved_by_id: adminId,
      resolved_by_name: adminName,
      resolved_at: new Date().toISOString(),
    };

    this.localStore.passwordResetRequests[index] = updatedReq;
    this.saveLocalStore();

    const rowNumber = index + 2;
    const row = [
      updatedReq.id,
      updatedReq.username,
      updatedReq.user_id || '',
      updatedReq.status,
      updatedReq.resolved_by_id || '',
      updatedReq.created_at,
      updatedReq.resolved_at || '',
    ];
    await this.syncUpdateCellRange('PasswordResetRequests', rowNumber, row);

    return { request: updatedReq, tempPassword };
  }
}

export const sheetsRepo = new SheetsRepository();
