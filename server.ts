import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { sheetsRepo } from './src/server/sheetsRepository.js';
import { User, Role, Entry, CorrectionRequest, AuditLog, PasswordResetRequest } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory token store for session management
const sessions = new Map<string, { userId: string; createdAt: number }>();

// Simple IP rate-limiter map for reset password requests
const resetRateLimits = new Map<string, { count: number; resetAt: number }>();

function generateToken(): string {
  return `tk_${Date.now()}_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
}

// Authentication Middleware
async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  // Look up user fresh from repository to enforce active status and role checks on every request
  const user = await sheetsRepo.getUserById(session.userId);
  if (!user) {
    sessions.delete(token);
    res.status(401).json({ error: 'User account not found' });
    return;
  }

  // Disabled users must be blocked from logging in / executing endpoints
  if (!user.is_active) {
    sessions.delete(token);
    res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
    return;
  }

  (req as any).currentUser = user;
  (req as any).currentToken = token;
  next();
}

// Admin authorization middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user: User = (req as any).currentUser;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin permissions required for this action' });
    return;
  }
  next();
}

// IP Rate limiter for forgot password endpoint
function rateLimitPasswordReset(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5;

  const current = resetRateLimits.get(ip);
  if (!current || now > current.resetAt) {
    resetRateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (current.count >= maxRequests) {
    res.status(429).json({ error: 'Too many password reset requests from this IP. Please try again later.' });
    return;
  }

  current.count += 1;
  next();
}

// Helper: generate random temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pass = '';
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// ---------------- API ROUTES ----------------

// 1. Auth Endpoints
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const user = await sheetsRepo.getUserByUsername(String(username));
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
    return;
  }

  const isValidPassword = sheetsRepo.verifyPassword(user.id, String(password));
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = generateToken();
  sessions.set(token, { userId: user.id, createdAt: Date.now() });

  res.json({
    user,
    token,
  });
});

app.post('/api/auth/logout', authenticateUser, (req: Request, res: Response) => {
  const token = (req as any).currentToken;
  if (token) {
    sessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateUser, (req: Request, res: Response) => {
  const user: User = (req as any).currentUser;
  res.json({ user });
});

app.post('/api/auth/change-password', authenticateUser, async (req: Request, res: Response) => {
  const user: User = (req as any).currentUser;
  const { newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long' });
    return;
  }

  const updatedUser = await sheetsRepo.updateUser(user.id, {
    password: newPassword.trim(),
    must_reset_password: false,
  });

  res.json({
    success: true,
    user: updatedUser,
    message: 'Password changed successfully',
  });
});

app.post('/api/auth/request-password-reset', rateLimitPasswordReset, async (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  await sheetsRepo.createPasswordResetRequest(username.trim());

  // Always return generic response to avoid leaking valid usernames
  res.json({
    success: true,
    message: 'If an account with that username exists, a password reset request has been submitted to your administrator.',
  });
});

// 2. Admin User Management
app.get('/api/admin/users', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const users = await sheetsRepo.getUsers();
  res.json({ users });
});

app.post('/api/admin/users', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const admin: User = (req as any).currentUser;
  const { username, name, role } = req.body;

  if (!username || !name || !role) {
    res.status(400).json({ error: 'Username, name, and role are required' });
    return;
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const existing = await sheetsRepo.getUserByUsername(cleanUsername);
  if (existing) {
    res.status(400).json({ error: `Username "${cleanUsername}" is already in use` });
    return;
  }

  const tempPassword = generateTempPassword();
  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    name: String(name).trim(),
    role: role === 'admin' ? 'admin' : 'user',
    must_reset_password: true,
    is_active: true,
    created_by: admin.name,
    created_at: new Date().toISOString(),
  };

  const created = await sheetsRepo.createUser(newUser, tempPassword);

  res.json({
    user: created,
    tempPassword,
    message: 'User created successfully',
  });
});

app.patch('/api/admin/users/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, is_active, resetPassword } = req.body;

  let tempPassword = '';
  const updates: Partial<User> & { password?: string } = {};

  if (role !== undefined) {
    updates.role = role === 'admin' ? 'admin' : 'user';
  }
  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
  }
  if (resetPassword) {
    tempPassword = generateTempPassword();
    updates.password = tempPassword;
    updates.must_reset_password = true;
  }

  const updated = await sheetsRepo.updateUser(id, updates);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: updated,
    tempPassword: tempPassword || undefined,
    message: 'User updated successfully',
  });
});

// 3. Password Reset Requests (Admin)
app.get('/api/admin/password-reset-requests', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const requests = await sheetsRepo.getPasswordResetRequests();
  res.json({ requests });
});

app.patch('/api/admin/password-reset-requests/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const admin: User = (req as any).currentUser;
  const { id } = req.params;

  const tempPassword = generateTempPassword();
  try {
    const result = await sheetsRepo.resolvePasswordResetRequest(id, tempPassword, admin.id, admin.name);
    if (!result) {
      res.status(404).json({ error: 'Reset request not found' });
      return;
    }

    res.json({
      request: result.request,
      tempPassword: result.tempPassword,
      message: 'Password reset request resolved successfully',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to resolve password reset' });
  }
});

// 4. Entries Endpoints
app.post('/api/entries', authenticateUser, async (req: Request, res: Response) => {
  const user: User = (req as any).currentUser;
  const { invoice_date, invoice_number, vendor_name, customer_name, issue_description } = req.body;

  if (!invoice_date || !invoice_number || !vendor_name || !customer_name || !issue_description) {
    res.status(400).json({ error: 'All fields (invoice_date, invoice_number, vendor_name, customer_name, issue_description) are required' });
    return;
  }

  const newEntry: Entry = {
    id: `ent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    invoice_date: String(invoice_date).trim(),
    invoice_number: String(invoice_number).trim(),
    vendor_name: String(vendor_name).trim(),
    customer_name: String(customer_name).trim(),
    issue_description: String(issue_description).trim(),
    submitted_by_id: user.id,
    submitted_by_name: user.name,
    submitted_at: new Date().toISOString(),
    status: 'active',
  };

  const created = await sheetsRepo.createEntry(newEntry);
  res.json({ entry: created, message: 'Invoice issue logged successfully' });
});

app.get('/api/entries', authenticateUser, async (req: Request, res: Response) => {
  const user: User = (req as any).currentUser;
  const includeDeleted = user.role === 'admin' && req.query.includeDeleted === 'true';

  let entries = await sheetsRepo.getEntries(includeDeleted);

  // A non-admin user can view their own entries only
  if (user.role !== 'admin') {
    entries = entries.filter(e => e.submitted_by_id === user.id || e.submitted_by_name?.toLowerCase() === user.name?.toLowerCase());
  }

  // Apply filters if provided
  const { startDate, endDate, vendorName, customerName, submittedBy } = req.query;

  if (startDate) {
    entries = entries.filter(e => e.invoice_date >= String(startDate));
  }
  if (endDate) {
    entries = entries.filter(e => e.invoice_date <= String(endDate));
  }
  if (vendorName) {
    const term = String(vendorName).toLowerCase();
    entries = entries.filter(e => e.vendor_name.toLowerCase().includes(term));
  }
  if (customerName) {
    const term = String(customerName).toLowerCase();
    entries = entries.filter(e => e.customer_name.toLowerCase().includes(term));
  }
  if (user.role === 'admin' && submittedBy) {
    const term = String(submittedBy).toLowerCase();
    entries = entries.filter(e => e.submitted_by_name.toLowerCase().includes(term) || e.submitted_by_id === submittedBy);
  }

  res.json({ entries });
});

app.get('/api/entries/:id/audit', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = await sheetsRepo.getAuditLogsForEntry(id);
  res.json({ auditLogs: logs });
});

app.patch('/api/entries/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const admin: User = (req as any).currentUser;
  const { id } = req.params;
  const { invoice_date, invoice_number, vendor_name, customer_name, issue_description, reason, correction_request_id } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    res.status(400).json({ error: 'A valid reason for editing this entry is required for audit logging' });
    return;
  }

  const updates: Partial<Entry> = {};
  if (invoice_date) updates.invoice_date = String(invoice_date).trim();
  if (invoice_number) updates.invoice_number = String(invoice_number).trim();
  if (vendor_name) updates.vendor_name = String(vendor_name).trim();
  if (customer_name) updates.customer_name = String(customer_name).trim();
  if (issue_description) updates.issue_description = String(issue_description).trim();

  const result = await sheetsRepo.updateEntry(
    id,
    updates,
    admin.id,
    admin.name,
    reason.trim(),
    correction_request_id ? String(correction_request_id) : undefined
  );

  if (!result) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  res.json({
    entry: result.entry,
    auditLog: result.auditLog,
    message: 'Entry updated and audit log recorded',
  });
});

app.delete('/api/entries/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const admin: User = (req as any).currentUser;
  const { id } = req.params;
  const reason = (req.body && req.body.reason) || req.query.reason || 'Admin soft-deleted entry';

  const result = await sheetsRepo.updateEntry(
    id,
    { status: 'deleted' },
    admin.id,
    admin.name,
    String(reason),
    undefined
  );

  if (!result) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  res.json({
    entry: result.entry,
    auditLog: result.auditLog,
    message: 'Entry soft-deleted successfully',
  });
});

app.post('/api/entries/:id/restore', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const admin: User = (req as any).currentUser;
  const { id } = req.params;
  const reason = (req.body && req.body.reason) || 'Admin restored entry';

  const result = await sheetsRepo.updateEntry(
    id,
    { status: 'active' },
    admin.id,
    admin.name,
    String(reason),
    undefined
  );

  if (!result) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  res.json({
    entry: result.entry,
    auditLog: result.auditLog,
    message: 'Entry restored successfully',
  });
});

// 5. Correction Requests Endpoints
app.post('/api/entries/:id/correction-request', authenticateUser, async (req: Request, res: Response) => {
  const user: User = (req as any).currentUser;
  const { id } = req.params;
  const { request_details } = req.body;

  if (!request_details || !String(request_details).trim()) {
    res.status(400).json({ error: 'Correction request details are required' });
    return;
  }

  const entry = await sheetsRepo.getEntryById(id);
  if (!entry) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }

  const newRequest: CorrectionRequest = {
    id: `crq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    entry_id: id,
    entry_invoice_number: entry.invoice_number,
    entry_vendor_name: entry.vendor_name,
    requested_by_id: user.id,
    requested_by_name: user.name,
    request_details: String(request_details).trim(),
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const created = await sheetsRepo.createCorrectionRequest(newRequest);
  res.json({ correctionRequest: created, message: 'Correction request submitted' });
});

app.get('/api/correction-requests/mine', authenticateUser, async (req: Request, res: Response) => {
  const user: User = (req as any).currentUser;
  const requests = await sheetsRepo.getCorrectionRequests(user.id);
  res.json({ requests });
});

app.get('/api/correction-requests', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const requests = await sheetsRepo.getCorrectionRequests();
  res.json({ requests });
});

app.patch('/api/correction-requests/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  const admin: User = (req as any).currentUser;
  const { id } = req.params;
  const { status, admin_response, updatedEntryFields } = req.body;

  if (status !== 'actioned' && status !== 'rejected') {
    res.status(400).json({ error: 'Status must be "actioned" or "rejected"' });
    return;
  }

  const reqObj = (await sheetsRepo.getCorrectionRequests()).find(r => r.id === id);
  if (!reqObj) {
    res.status(404).json({ error: 'Correction request not found' });
    return;
  }

  // If status is actioned and updatedEntryFields are provided, update the underlying entry
  if (status === 'actioned' && updatedEntryFields) {
    await sheetsRepo.updateEntry(
      reqObj.entry_id,
      updatedEntryFields,
      admin.id,
      admin.name,
      `Actioned correction request #${id}: ${admin_response || 'Resolved by admin'}`,
      id
    );
  }

  const updatedReq = await sheetsRepo.updateCorrectionRequest(
    id,
    status,
    String(admin_response || '').trim(),
    admin.id,
    admin.name
  );

  res.json({
    correctionRequest: updatedReq,
    message: `Correction request marked as ${status}`,
  });
});

// 6. Dashboard Metrics
app.get('/api/dashboard/summary', authenticateUser, async (req: Request, res: Response) => {
  const user: User = (req as any).currentUser;
  const targetUserId = req.query.userId ? String(req.query.userId) : null;

  let allEntries = await sheetsRepo.getEntries(true);

  // A non-admin user can view their own dashboard metrics only.
  // Admins can view overall system dashboard (when userId is missing or 'all') or any specific user's dashboard.
  if (user.role !== 'admin') {
    allEntries = allEntries.filter(e => e.submitted_by_id === user.id || e.submitted_by_name?.toLowerCase() === user.name?.toLowerCase());
  } else if (targetUserId && targetUserId !== 'all') {
    const targetUserObj = (await sheetsRepo.getUsers()).find(u => u.id === targetUserId || u.username === targetUserId);
    if (targetUserObj) {
      allEntries = allEntries.filter(e => e.submitted_by_id === targetUserObj.id || e.submitted_by_name?.toLowerCase() === targetUserObj.name?.toLowerCase());
    } else {
      allEntries = allEntries.filter(e => e.submitted_by_id === targetUserId || e.submitted_by_name?.toLowerCase() === targetUserId.toLowerCase());
    }
  }

  const activeEntries = allEntries.filter(e => e.status === 'active');
  const deletedEntries = allEntries.filter(e => e.status === 'deleted');

  let correctionRequests = await sheetsRepo.getCorrectionRequests();
  if (user.role !== 'admin') {
    correctionRequests = correctionRequests.filter(c => c.requested_by_id === user.id);
  } else if (targetUserId && targetUserId !== 'all') {
    correctionRequests = correctionRequests.filter(c => c.requested_by_id === targetUserId);
  }
  const pendingCorrections = correctionRequests.filter(c => c.status === 'pending').length;

  // Top vendors
  const vendorCounts: Record<string, number> = {};
  activeEntries.forEach(e => {
    vendorCounts[e.vendor_name] = (vendorCounts[e.vendor_name] || 0) + 1;
  });
  const topVendors = Object.entries(vendorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top customers
  const customerCounts: Record<string, number> = {};
  activeEntries.forEach(e => {
    customerCounts[e.customer_name] = (customerCounts[e.customer_name] || 0) + 1;
  });
  const topCustomers = Object.entries(customerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Trend data by month/week
  const monthCounts: Record<string, number> = {};
  activeEntries.forEach(e => {
    const month = e.invoice_date.substring(0, 7) || 'Unknown';
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const trendData = Object.entries(monthCounts)
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const recentEntries = [...activeEntries]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .slice(0, 5);

  res.json({
    summary: {
      totalIssues: allEntries.length,
      totalActiveIssues: activeEntries.length,
      totalDeletedIssues: deletedEntries.length,
      pendingCorrectionRequests: pendingCorrections,
      topVendors,
      topCustomers,
      trendData,
      recentEntries,
    },
  });
});

// 7. Google Sheets Admin Config Endpoints
app.get('/api/admin/sheets-config', authenticateUser, requireAdmin, (req: Request, res: Response) => {
  const config = sheetsRepo.getSheetsConfig();
  res.json({ config });
});

app.post('/api/admin/sheets-config', authenticateUser, requireAdmin, (req: Request, res: Response) => {
  const { spreadsheetId, clientEmail, privateKey } = req.body;
  if (!spreadsheetId) {
    res.status(400).json({ error: 'Spreadsheet ID is required' });
    return;
  }

  sheetsRepo.updateSheetsConfig(String(spreadsheetId), clientEmail ? String(clientEmail) : undefined, privateKey ? String(privateKey) : undefined);
  res.json({
    config: sheetsRepo.getSheetsConfig(),
    message: 'Google Sheets configuration updated',
  });
});

app.post('/api/admin/sheets-sync-all', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await sheetsRepo.exportAllToGoogleSheets();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync data to Google Sheets' });
  }
});

// ---------------- STATIC PWA ASSET ROUTES ----------------

const publicPath = path.join(process.cwd(), 'public');

app.get('/manifest.json', (req: Request, res: Response) => {
  const filePath = path.join(publicPath, 'manifest.json');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'manifest.json file not found' });
  }
});

app.get('/sw.js', (req: Request, res: Response) => {
  const filePath = path.join(publicPath, 'sw.js');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
  } else {
    res.status(404).send('sw.js file not found');
  }
});

app.get('/icon.svg', (req: Request, res: Response) => {
  const filePath = path.join(publicPath, 'icon.svg');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(filePath);
  } else {
    res.status(404).send('icon.svg file not found');
  }
});

app.use(express.static(publicPath));

// ---------------- START SERVER & VITE MIDDLEWARE ----------------

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.includes('.') && !req.path.endsWith('.html')) {
        res.status(404).send('Asset not found');
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Invoice Issue Tracker backend running on http://0.0.0.0:${PORT}`);
  });
}

start();
