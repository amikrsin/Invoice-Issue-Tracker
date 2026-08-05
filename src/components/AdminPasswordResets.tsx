import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { PasswordResetRequest } from '../types';
import { KeyRound, CheckCircle2, Clock, Copy, Check, ShieldCheck } from 'lucide-react';

export const AdminPasswordResets: React.FC = () => {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolved modal state displaying generated temp password
  const [resolvedResult, setResolvedResult] = useState<{
    request: PasswordResetRequest;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPasswordResetRequests();
      setRequests(res.requests);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch password reset requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleResolve = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await api.resolvePasswordResetRequest(id);
      setResolvedResult({
        request: res.request,
        tempPassword: res.tempPassword,
      });
      fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve reset request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <KeyRound className="w-6 h-6 text-indigo-600" />
          <span>Admin: Password Reset Requests Queue</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Resolve locked-out user password reset requests and hand generated temp passwords to team members.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading password reset queue...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No password reset requests logged.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Resolved By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {requests.map((req) => {
                  const isPending = req.status === 'pending';
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-900">
                        #{req.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        @{req.username}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {isPending ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Resolved</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {req.resolved_by_name || req.resolved_by_id || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <button
                            onClick={() => handleResolve(req.id)}
                            disabled={actionLoadingId === req.id}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                          >
                            {actionLoadingId === req.id ? 'Generating...' : 'Resolve & Generate Password'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {req.resolved_at ? new Date(req.resolved_at).toLocaleDateString() : 'Completed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolved Result Dialog with Copy Password Button */}
      {resolvedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Reset Resolved Successfully
                </h3>
                <p className="text-xs text-slate-400">
                  Temporary password generated for @{resolvedResult.request.username}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-xl space-y-2">
              <div className="text-xs text-slate-400">Temporary Password:</div>
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="font-mono text-base font-bold text-emerald-400 tracking-wider">
                  {resolvedResult.tempPassword}
                </span>
                <button
                  onClick={() => copyToClipboard(resolvedResult.tempPassword)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
              Hand this temporary password to the team member in person, by phone/WhatsApp, or email. The user will be forced to set a new password upon their next login.
            </div>

            <button
              onClick={() => setResolvedResult(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
