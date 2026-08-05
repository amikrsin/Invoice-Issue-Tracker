import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, Entry } from '../types';
import {
  ListFilter,
  Search,
  Calendar,
  Building2,
  User as UserIcon,
  HelpCircle,
  Edit2,
  Trash2,
  RotateCcw,
  History,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface EntriesListProps {
  currentUser: User;
  onOpenAuditModal: (entryId: string, invoiceNumber: string) => void;
  refreshTrigger?: number;
}

export const EntriesList: React.FC<EntriesListProps> = ({
  currentUser,
  onOpenAuditModal,
  refreshTrigger,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vendorNameFilter, setVendorNameFilter] = useState('');
  const [customerNameFilter, setCustomerNameFilter] = useState('');
  const [submittedByFilter, setSubmittedByFilter] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Correction Request Modal State (for regular users)
  const [correctionModalEntry, setCorrectionModalEntry] = useState<Entry | null>(null);
  const [correctionDetails, setCorrectionDetails] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionFeedback, setCorrectionFeedback] = useState<string | null>(null);

  // Admin Edit Entry Modal State
  const [editModalEntry, setEditModalEntry] = useState<Entry | null>(null);
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editVendorName, setEditVendorName] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editIssueDescription, setEditIssueDescription] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Admin Delete Confirmation Modal State
  const [deleteModalEntry, setDeleteModalEntry] = useState<Entry | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEntries({
        includeDeleted,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        vendorName: vendorNameFilter || undefined,
        customerName: customerNameFilter || undefined,
        submittedBy: submittedByFilter || undefined,
      });
      setEntries(res.entries);
    } catch (err: any) {
      setError(err.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [includeDeleted, refreshTrigger]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEntries();
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setVendorNameFilter('');
    setCustomerNameFilter('');
    setSubmittedByFilter('');
    setIncludeDeleted(false);
    setTimeout(() => {
      fetchEntries();
    }, 50);
  };

  // User submits Correction Request
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionModalEntry || !correctionDetails.trim()) return;

    setCorrectionLoading(true);
    setCorrectionFeedback(null);
    try {
      await api.createCorrectionRequest(correctionModalEntry.id, correctionDetails.trim());
      setCorrectionFeedback('Correction request submitted to admin queue.');
      setTimeout(() => {
        setCorrectionModalEntry(null);
        setCorrectionDetails('');
        setCorrectionFeedback(null);
      }, 1500);
    } catch (err: any) {
      setCorrectionFeedback(err.message || 'Failed to submit request');
    } finally {
      setCorrectionLoading(false);
    }
  };

  // Open Edit Modal (Admin)
  const openEditModal = (entry: Entry) => {
    setEditModalEntry(entry);
    setEditInvoiceDate(entry.invoice_date);
    setEditInvoiceNumber(entry.invoice_number);
    setEditVendorName(entry.vendor_name);
    setEditCustomerName(entry.customer_name);
    setEditIssueDescription(entry.issue_description);
    setEditReason('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalEntry || !editReason.trim()) return;

    setEditLoading(true);
    try {
      await api.updateEntry(editModalEntry.id, {
        invoice_date: editInvoiceDate,
        invoice_number: editInvoiceNumber,
        vendor_name: editVendorName,
        customer_name: editCustomerName,
        issue_description: editIssueDescription,
        reason: editReason.trim(),
      });
      setEditModalEntry(null);
      fetchEntries();
    } catch (err: any) {
      alert(err.message || 'Failed to update entry');
    } finally {
      setEditLoading(false);
    }
  };

  // Soft Delete (Admin)
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteModalEntry || !deleteReason.trim()) return;

    setDeleteLoading(true);
    try {
      await api.deleteEntry(deleteModalEntry.id, deleteReason.trim());
      setDeleteModalEntry(null);
      setDeleteReason('');
      fetchEntries();
    } catch (err: any) {
      alert(err.message || 'Failed to delete entry');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Restore Soft-Deleted Entry (Admin)
  const handleRestoreEntry = async (entry: Entry) => {
    if (!window.confirm(`Restore invoice issue #${entry.invoice_number}?`)) return;

    try {
      await api.restoreEntry(entry.id, 'Admin restored entry from soft-deleted list');
      fetchEntries();
    } catch (err: any) {
      alert(err.message || 'Failed to restore entry');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <ListFilter className="w-6 h-6 text-indigo-600" />
            <span>{isAdmin ? 'All Logged Invoice Issues (Admin)' : 'My Logged Invoice Issues'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? 'Centralized repository of all invoice issue entries submitted across all team members.'
              : `Viewing invoice issues submitted by you (${currentUser.name}).`}
          </p>
        </div>

        {isAdmin ? (
          <label className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 cursor-pointer transition-colors font-medium">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Include Soft-Deleted Entries</span>
          </label>
        ) : (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
            <UserIcon className="w-3.5 h-3.5" />
            <span>My Entries Only ({entries.length})</span>
          </span>
        )}
      </div>

      {/* Search & Filter Bar */}
      <form onSubmit={handleApplyFilters} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Vendor Name
            </label>
            <input
              type="text"
              placeholder="Filter vendor..."
              value={vendorNameFilter}
              onChange={(e) => setVendorNameFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              placeholder="Filter customer..."
              value={customerNameFilter}
              onChange={(e) => setCustomerNameFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Submitted By
              </label>
              <input
                type="text"
                placeholder="Filter user..."
              value={submittedByFilter}
              onChange={(e) => setSubmittedByFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors font-medium"
          >
            Clear Filters
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </form>

      {/* Entries Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading invoice entries from repository...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No invoice issue entries found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 max-w-xs">Issue Description</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {entries.map((entry) => {
                  const isDeleted = entry.status === 'deleted';
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDeleted ? 'bg-rose-50/30 text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                        {entry.invoice_date}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        #{entry.invoice_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {entry.vendor_name}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {entry.customer_name}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={entry.issue_description}>
                        {entry.issue_description}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{entry.submitted_by_name}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(entry.submitted_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isDeleted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            Deleted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        )}
                        {entry.last_edited_at && (
                          <div className="text-[9px] text-indigo-600 mt-0.5 font-medium">
                            Edited by {entry.last_edited_by}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Regular User: Correction Request */}
                          {!isAdmin && !isDeleted && (
                            <button
                              onClick={() => {
                                setCorrectionModalEntry(entry);
                                setCorrectionDetails('');
                                setCorrectionFeedback(null);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center space-x-1"
                              title="Request correction on your entry"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Request Correction</span>
                            </button>
                          )}

                          {/* Admin Actions */}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => onOpenAuditModal(entry.id, entry.invoice_number)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="View Entry Audit History"
                              >
                                <History className="w-4 h-4" />
                              </button>

                              {!isDeleted ? (
                                <>
                                  <button
                                    onClick={() => openEditModal(entry)}
                                    className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                    title="Edit Entry (Requires Reason)"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteModalEntry(entry);
                                      setDeleteReason('');
                                    }}
                                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Soft-Delete Entry"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleRestoreEntry(entry)}
                                  className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center space-x-1"
                                  title="Restore Entry"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Correction Request Modal (User) */}
      {correctionModalEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setCorrectionModalEntry(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              <span>Raise Correction Request</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Submitted entries are immutable. Submit a request detailing required updates for admin review.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-4">
              <div>Invoice #: <strong className="font-mono">#{correctionModalEntry.invoice_number}</strong></div>
              <div>Vendor: <strong>{correctionModalEntry.vendor_name}</strong></div>
            </div>

            {correctionFeedback ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{correctionFeedback}</span>
              </div>
            ) : (
              <form onSubmit={handleCorrectionSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Details of Correction Needed *
                  </label>
                  <textarea
                    value={correctionDetails}
                    onChange={(e) => setCorrectionDetails(e.target.value)}
                    rows={3}
                    placeholder="Specify what details are incorrect (e.g. vendor name should be Apex Freight Solutions)..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setCorrectionModalEntry(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={correctionLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
                  >
                    {correctionLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Admin Edit Modal */}
      {editModalEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditModalEntry(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <Edit2 className="w-5 h-5 text-amber-600" />
              <span>Admin Entry Edit</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              All admin edits trigger a permanent AuditLog snapshot before and after modification.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={editInvoiceDate}
                    onChange={(e) => setEditInvoiceDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={editInvoiceNumber}
                    onChange={(e) => setEditInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Name</label>
                <input
                  type="text"
                  value={editVendorName}
                  onChange={(e) => setEditVendorName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Description</label>
                <textarea
                  value={editIssueDescription}
                  onChange={(e) => setEditIssueDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs resize-none"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                <label className="block text-xs font-bold text-amber-900">
                  Audit Log Reason for Edit *
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Corrected vendor name per vendor master record..."
                  className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalEntry(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading || !editReason.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save & Record Audit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Confirmation Modal */}
      {deleteModalEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setDeleteModalEntry(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <span>Soft-Delete Invoice Entry</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              This entry will be marked soft-deleted and hidden from default views. Rows are never hard-deleted.
            </p>

            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>Invoice #: <strong className="font-mono">#{deleteModalEntry.invoice_number}</strong></div>
                <div>Vendor: <strong>{deleteModalEntry.vendor_name}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Deletion (Required for Audit Log) *
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Duplicate entry submitted accidentally..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalEntry(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || !deleteReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Confirm Soft-Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
