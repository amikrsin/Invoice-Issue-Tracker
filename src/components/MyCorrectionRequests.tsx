import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { CorrectionRequest } from '../types';
import { HelpCircle, Clock, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';

export const MyCorrectionRequests: React.FC = () => {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMyCorrectionRequests();
      setRequests(res.requests);
    } catch (err: any) {
      setError(err.message || 'Failed to load correction requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <HelpCircle className="w-6 h-6 text-indigo-600" />
          <span>My Correction Requests</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Track status and admin response notes for entry correction requests you have submitted.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading requests...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            You have not raised any correction requests yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((req) => (
              <div key={req.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      Entry #{req.entry_invoice_number || req.entry_id}
                    </span>
                    {req.entry_vendor_name && (
                      <span className="text-xs text-slate-500 font-medium">
                        ({req.entry_vendor_name})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {req.status === 'pending' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Pending Admin Review</span>
                      </span>
                    )}

                    {req.status === 'actioned' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Actioned</span>
                      </span>
                    )}

                    {req.status === 'rejected' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs text-slate-700">
                  <div className="font-semibold text-slate-900 mb-0.5">Requested Details:</div>
                  <div>{req.request_details}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Submitted: {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>

                {req.admin_response && (
                  <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 text-xs text-indigo-950 flex items-start space-x-2.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-indigo-900">Admin Response:</div>
                      <div>{req.admin_response}</div>
                      {req.resolved_at && (
                        <div className="text-[10px] text-indigo-500 font-mono mt-1">
                          Resolved: {new Date(req.resolved_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
