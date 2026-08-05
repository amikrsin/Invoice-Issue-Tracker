import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AuditLog } from '../types';
import { History, X, Shield, ArrowRight, FileJson } from 'lucide-react';

interface AuditHistoryModalProps {
  entryId: string;
  invoiceNumber: string;
  onClose: () => void;
}

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  entryId,
  invoiceNumber,
  onClose,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getAuditLogsForEntry(entryId);
        setLogs(res.auditLogs);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch audit log history');
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [entryId]);

  const parseSnapshot = (snapshotStr: string) => {
    try {
      if (!snapshotStr) return null;
      return JSON.parse(snapshotStr);
    } catch {
      return snapshotStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>Immutable Audit History</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-indigo-300">
                  #{invoiceNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Complete before/after snapshot trail for entry #{entryId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Querying audit log records...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl text-center">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No audit log entries recorded for this item. Entry has never been edited or deleted.
            </div>
          ) : (
            logs.map((log) => {
              const before = parseSnapshot(log.before_snapshot);
              const after = parseSnapshot(log.after_snapshot);

              return (
                <div
                  key={log.id}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 text-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`uppercase font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          log.action === 'edit'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : log.action === 'delete'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-slate-300 font-medium">
                        by {log.admin_name || log.admin_id}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-300 mb-0.5">
                      Reason Recorded:
                    </div>
                    <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-slate-200 font-mono text-[11px]">
                      {log.reason || 'N/A'}
                    </div>
                  </div>

                  {log.correction_request_id && (
                    <div className="text-[10px] text-indigo-300 font-mono">
                      Associated Correction Request ID: #{log.correction_request_id}
                    </div>
                  )}

                  {/* Diff snapshots */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                      <div className="font-semibold text-rose-400 mb-1 flex items-center space-x-1">
                        <FileJson className="w-3.5 h-3.5" />
                        <span>Before Snapshot</span>
                      </div>
                      <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {typeof before === 'object' ? JSON.stringify(before, null, 2) : before}
                      </pre>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
                      <div className="font-semibold text-emerald-400 mb-1 flex items-center space-x-1">
                        <FileJson className="w-3.5 h-3.5" />
                        <span>After Snapshot</span>
                      </div>
                      <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {typeof after === 'object' ? JSON.stringify(after, null, 2) : after || '(Empty)'}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
