import React, { useState } from 'react';
import { api } from '../lib/api';
import { User, Entry } from '../types';
import { PlusCircle, CheckCircle2, AlertCircle, ArrowRight, FileText, Calendar, Hash, Building2, UserCheck } from 'lucide-react';

interface QuickEntryFormProps {
  currentUser: User;
  onEntryAdded: (entry: Entry) => void;
  onViewEntries: () => void;
}

export const QuickEntryForm: React.FC<QuickEntryFormProps> = ({
  currentUser,
  onEntryAdded,
  onViewEntries,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [issueDescription, setIssueDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEntry, setSuccessEntry] = useState<Entry | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceDate || !invoiceNumber.trim() || !vendorName.trim() || !customerName.trim() || !issueDescription.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.createEntry({
        invoice_date: invoiceDate,
        invoice_number: invoiceNumber.trim(),
        vendor_name: vendorName.trim(),
        customer_name: customerName.trim(),
        issue_description: issueDescription.trim(),
      });

      setSuccessEntry(res.entry);
      onEntryAdded(res.entry);

      // Reset form fields
      setInvoiceNumber('');
      setVendorName('');
      setCustomerName('');
      setIssueDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit invoice issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-4 sm:py-8 px-4">
      {/* Compact Dialog-style Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden transition-all">
        {/* Compact Card Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Log Invoice Issue</h2>
              <p className="text-[11px] text-slate-400">Vendor Bill Issue Entry Form</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Vendor Bill
          </span>
        </div>

        <div className="p-5 sm:p-6">
          {/* Success Notification Banner */}
          {successEntry ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-5 space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900">
                    Issue Logged Successfully
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Invoice <span className="font-mono font-bold">#{successEntry.invoice_number}</span> ({successEntry.vendor_name}) has been appended to the repository.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1 border-t border-emerald-200/80">
                <button
                  type="button"
                  onClick={() => setSuccessEntry(null)}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors text-center"
                >
                  Log Another Issue
                </button>
                <button
                  type="button"
                  onClick={onViewEntries}
                  className="flex-1 py-2 px-3 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-medium rounded-lg transition-colors text-center flex items-center justify-center space-x-1"
                >
                  <span>View All Entries</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Row 1: Date & Number */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Invoice Date *</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>Invoice No. *</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-9042"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                  required
                />
              </div>
            </div>

            {/* Vendor Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Vendor Name *</span>
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Vendor issuing this bill (e.g. Apex Logistics)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Customer Name *</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer related to this vendor bill (e.g. Acme Corp)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Issue Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Issue Description *</span>
              </label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={3}
                placeholder="Describe discrepancy, missing tax credit, pricing error, or dispute details..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                required
              />
            </div>

            {/* Auto-filled Submitter Footer */}
            <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <div>Submitted by: <strong className="text-slate-900">{currentUser.name}</strong></div>
              <div className="text-slate-400 font-mono text-[10px]">Auto-Captured</div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Submit Invoice Issue Entry</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
