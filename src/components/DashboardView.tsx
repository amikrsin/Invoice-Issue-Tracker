import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { DashboardSummary, User } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Building2,
  Users,
  FileText,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Filter,
  UserCheck,
} from 'lucide-react';

interface DashboardViewProps {
  currentUser: User;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser }) => {
  const isAdmin = currentUser.role === 'admin';
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin dashboard scope filter
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [usersList, setUsersList] = useState<User[]>([]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboardSummary({
        userId: !isAdmin ? currentUser.id : selectedUserId,
      });
      setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load executive dashboard summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      api.getUsers().then((res) => {
        if (res.users) setUsersList(res.users);
      }).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchSummary();
  }, [selectedUserId, currentUser.id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span>Aggregating executive metrics...</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 text-center text-rose-600 text-xs">
        {error || 'Unable to render executive metrics'}
      </div>
    );
  }

  const selectedUserObj = usersList.find(u => u.id === selectedUserId);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <span>
              {isAdmin
                ? 'Executive Risk & Invoice Dashboard'
                : `Executive Dashboard - ${currentUser.name}`}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? 'Real-time aggregate overview of logged vendor & customer invoice disputes.'
              : `Viewing issue metrics, vendor breakdowns, and trends logged by ${currentUser.name}.`}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isAdmin && (
            <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs">
              <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-semibold text-slate-600 hidden sm:inline">Scope:</span>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">📊 All Users (System Summary)</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role === 'admin' ? 'Admin' : 'User'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={fetchSummary}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {isAdmin && selectedUserId !== 'all' && selectedUserObj && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center space-x-2">
          <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            Filtering executive report for user: <strong>{selectedUserObj.name}</strong> ({selectedUserObj.username})
          </span>
        </div>
      )}

      {/* Looker Studio Notice Box */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-800/50 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 font-bold text-sm text-indigo-300">
            <span>External Looker Studio Dashboard Connection</span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Because all entries are stored directly in your Google Sheet repository, senior executives can also access live Google Looker Studio reports connected directly to the spreadsheet.
          </p>
        </div>
        <a
          href="https://lookerstudio.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition-colors flex items-center space-x-1.5 shrink-0 w-fit"
        >
          <span>Open Looker Studio</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Active Issues</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {summary.totalActiveIssues}
          </div>
          <div className="text-[10px] text-slate-400">
            {summary.totalIssues} total recorded historically
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Affected Vendors</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {summary.topVendors.length}
          </div>
          <div className="text-[10px] text-slate-400">
            Top: {summary.topVendors[0]?.name || 'N/A'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Affected Customers</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {summary.topCustomers.length}
          </div>
          <div className="text-[10px] text-slate-400">
            Top: {summary.topCustomers[0]?.name || 'N/A'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Corrections</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {summary.pendingCorrectionRequests}
          </div>
          <div className="text-[10px] text-slate-400">
            Awaiting admin resolution
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Top Vendors by Issue Count</span>
          </h2>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.topVendors} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Issues" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Top Customers Affected</span>
          </h2>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.topCustomers} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} name="Issues" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Trend Over Time & Recent Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>Invoice Issues Trend Over Time</span>
          </h2>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} name="Logged Issues" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Feed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Recent Entries Feed</span>
          </h2>

          <div className="space-y-3">
            {summary.recentEntries.map((e) => (
              <div key={e.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="font-mono">#{e.invoice_number}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{e.invoice_date}</span>
                </div>
                <div className="text-slate-700 font-medium">{e.vendor_name}</div>
                <div className="text-[11px] text-slate-500 line-clamp-1">{e.issue_description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
