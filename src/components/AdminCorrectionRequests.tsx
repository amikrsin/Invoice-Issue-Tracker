import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { CorrectionRequest, Entry } from '../types';
import { ShieldAlert, CheckCircle2, XCircle, Clock, Edit2, MessageSquare, X } from 'lucide-react';

export const AdminCorrectionRequests: React.FC = () => {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'actioned' | 'rejected'>('pending');

  // Action / Edit Entry Modal
  const [actionReq, setActionReq] = useState<CorrectionRequest | null>(null);
  const [targetEntry, setTargetEntry] = useState<Entry | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reject Modal
  const [rejectReq, setRejectReq] = useState<CorrectionRequest | null>(null);
  const [rejectResponse, setRejectResponse] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAllCorrectionRequests();
      setRequests(res.requests);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch correction requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const openActionModal = async (req: CorrectionRequest) => {
    setActionReq(req);
    setAdminResponse('Updated entry per correction request.');
    try {
      const entriesRes = await api.getEntries({ includeDeleted: true });
      const found = entriesRes.entries.find((e) => e.id === req.entry_id);
      if (found) {
        setTargetEntry(found);
        setEditDate(found.invoice_date);
        setEditNumber(found.invoice_number);
        setEditVendor(found.vendor_name);
        setEditCustomer(found.customer_name);
        setEditDesc(found.issue_description);
      }
    } catch {
      // Handled silently
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionReq) return;

    setActionLoading(true);
    try {
      await api.updateCorrectionRequest(
        actionReq.id,
        'actioned',
        adminResponse.trim() || 'Actioned by admin',
        {
          invoice_date: editDate,
          invoice_number: editNumber,
          vendor_name: editVendor,
          customer_name: editCustomer,
          issue_description: editDesc,
        }
      );
      setActionReq(null);
      fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to action request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReq || !rejectResponse.trim()) return;

    setRejectLoading(true);
    try {
      await api.updateCorrectionRequest(
        rejectReq.id,
        'rejected',
        rejectResponse.trim()
      );
      setRejectReq(null);
      setRejectResponse('');
      fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            <span>Admin: Correction Requests Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review and action entry correction requests raised by team members.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
          {(['pending', 'actioned', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`capitalize px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading requests queue...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No correction requests found with status "{statusFilter}".
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRequests.map((req) => (
              <div key={req.id} className="p-5 hover:bg-slate-50/80 transition-colors space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      Request #{req.id}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs text-slate-600">
                      Entry: <strong className="font-mono">#{req.entry_invoice_number || req.entry_id}</strong>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs text-slate-600">
                      By: <strong>{req.requested_by_name || req.requested_by_id}</strong>
                    </span>
                  </div>

                  <div>
                    {req.status === 'pending' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Pending Action
                      </span>
                    )}
                    {req.status === 'actioned' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Actioned
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                        Rejected
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800">
                  <div className="font-semibold text-slate-900 mb-0.5">Request Details:</div>
                  <div>{req.request_details}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    Created: {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>

                {req.admin_response && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 space-y-0.5">
                    <div className="font-bold">Admin Response Note:</div>
                    <div>{req.admin_response}</div>
                    <div className="text-[10px] text-indigo-500 font-mono">
                      Resolved by {req.resolved_by_name || req.resolved_by_id} at {new Date(req.resolved_at || '').toLocaleString()}
                    </div>
                  </div>
                )}

                {req.status === 'pending' && (
                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      onClick={() => {
                        setRejectReq(req);
                        setRejectResponse('');
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium rounded-xl transition-colors flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Request</span>
                    </button>

                    <button
                      onClick={() => openActionModal(req)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow transition-colors flex items-center space-x-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Action & Edit Entry</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action / Edit Modal */}
      {actionReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActionReq(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              <span>Action Correction Request</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Modify the entry fields directly. An audit log will be appended referencing request #{actionReq.id}.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs mb-4 text-amber-900">
              <strong className="block mb-0.5">User Request Details:</strong>
              <div>{actionReq.request_details}</div>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Name</label>
                <input
                  type="text"
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editCustomer}
                  onChange={(e) => setEditCustomer(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Response Note *</label>
                <input
                  type="text"
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="e.g. Updated invoice number and vendor per correction request..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionReq(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
                >
                  {actionLoading ? 'Saving...' : 'Save & Resolve Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setRejectReq(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              <span>Reject Correction Request</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Provide a clear reason why this request is rejected.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Response Note *
                </label>
                <textarea
                  value={rejectResponse}
                  onChange={(e) => setRejectResponse(e.target.value)}
                  rows={3}
                  placeholder="e.g. Original invoice number matches physically provided invoice copy..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRejectReq(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectLoading || !rejectResponse.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {rejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
