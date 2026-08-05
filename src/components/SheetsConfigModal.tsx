import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { SheetsConfig } from '../types';
import { Database, Copy, Check, ExternalLink, ShieldCheck, AlertCircle, X } from 'lucide-react';

interface SheetsConfigModalProps {
  onClose: () => void;
  onConfigUpdated: (config: SheetsConfig) => void;
}

export const SheetsConfigModal: React.FC<SheetsConfigModalProps> = ({
  onClose,
  onConfigUpdated,
}) => {
  const [config, setConfig] = useState<SheetsConfig | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await api.getSheetsConfig();
        setConfig(res.config);
        setSpreadsheetId(res.config.spreadsheetId || '1aPGUbvtw_aMifaQ8yAZwBtu57HZZg7TX78-UFX6r5fE');
        setClientEmail(res.config.serviceAccountEmail || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load Google Sheets config');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spreadsheetId.trim()) {
      setError('Spreadsheet ID is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.updateSheetsConfig(
        spreadsheetId.trim(),
        clientEmail.trim() || undefined,
        privateKey.trim() || undefined
      );
      setConfig(res.config);
      onConfigUpdated(res.config);
      setSuccess('Google Sheets configuration saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncAll = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.syncAllToSheets();
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to sync data to Google Sheets. Please ensure your Google Sheet is shared with Editor permission to the Service Account email.');
    } finally {
      setSyncing(false);
    }
  };

  const copyEmail = () => {
    const email = clientEmail || config?.serviceAccountEmail || '';
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Google Sheets Repository Connection
            </h2>
            <p className="text-xs text-slate-400">
              Connect your single 5-tab Google Sheet to persist all internal issue entries.
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between text-xs mb-5">
          <span className="text-slate-300 font-medium">Repository Sync Status:</span>
          {config?.isConnected ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Google Sheets Connected</span>
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              Standalone Local Repository Active
            </span>
          )}
        </div>

        {/* Step-by-Step Instructions */}
        <div className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-xs space-y-2 mb-5">
          <div className="font-bold text-indigo-200">How to Connect your Google Sheet:</div>
          <ol className="list-decimal list-inside text-indigo-300 space-y-1">
            <li>Create or open your target Google Sheet.</li>
            <li>Ensure the 5 tabs exist: <code className="bg-slate-900 px-1 py-0.5 rounded">Users</code>, <code className="bg-slate-900 px-1 py-0.5 rounded">Entries</code>, <code className="bg-slate-900 px-1 py-0.5 rounded">AuditLog</code>, <code className="bg-slate-900 px-1 py-0.5 rounded">CorrectionRequests</code>, <code className="bg-slate-900 px-1 py-0.5 rounded">PasswordResetRequests</code>.</li>
            <li>Share the sheet with your Service Account Email with <strong>Editor</strong> permission.</li>
            <li>Paste your Spreadsheet ID below and click Save.</li>
          </ol>
        </div>

        {/* Service Account Email Box */}
        <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl mb-5 space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-400">
            Service Account Email (Grant Editor Access to this Email):
          </label>
          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <code className="text-xs font-mono text-emerald-400 break-all pr-2">
              {clientEmail || config?.serviceAccountEmail || 'service-account@project.iam.gserviceaccount.com'}
            </code>
            <button
              onClick={copyEmail}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md transition-colors flex items-center space-x-1 shrink-0"
            >
              {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEmail ? 'Copied' : 'Copy Email'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Google Spreadsheet ID *
            </label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Found in your Google Sheet URL: https://docs.google.com/spreadsheets/d/<strong>YOUR_SPREADSHEET_ID</strong>/edit
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Service Account Email (Optional Override)
            </label>
            <input
              type="text"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="e.g. service-account@gcp-project.iam.gserviceaccount.com"
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Service Account Key (Paste Raw JSON Key File content or -----BEGIN PRIVATE KEY-----)
            </label>
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={3}
              placeholder="Paste entire service_account.json key contents or Private Key string here..."
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-[10px] text-amber-300 mt-1">
              💡 Tip: You can paste your entire Google Service Account JSON key directly into this box. It will automatically extract your email and private key!
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncing}
              className="px-4 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition-colors flex items-center space-x-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{syncing ? 'Transferring All Data...' : 'Transfer All Store Data to Google Sheet'}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition-colors flex items-center space-x-1"
              >
                {saving ? 'Saving...' : 'Save & Connect Sheet'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
