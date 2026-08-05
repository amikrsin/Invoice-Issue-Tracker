import React, { useState, useEffect } from 'react';
import { User, SheetsConfig } from '../types';
import { api } from '../lib/api';
import {
  FileText,
  PlusCircle,
  ListFilter,
  HelpCircle,
  Users,
  KeyRound,
  BarChart3,
  LogOut,
  ShieldAlert,
  Database,
  Download,
  Key,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onChangePasswordClick: () => void;
  onOpenSheetsConfig: () => void;
  sheetsConfig: SheetsConfig | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  onChangePasswordClick,
  onOpenSheetsConfig,
  sheetsConfig,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-inner flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base sm:text-lg text-slate-100 tracking-tight">
                  Invoice Issue Tracker
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-block">
                  JM Jain LLP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Immutable Vendor Issue Log & Repository
              </p>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Sheets Sync Indicator (Admin Only) */}
            {isAdmin && (
              <button
                onClick={onOpenSheetsConfig}
                title="Google Sheets Repository Configuration"
                className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  sheetsConfig?.isConnected
                    ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-amber-950/60 border-amber-800/80 text-amber-300 hover:bg-amber-900/60'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden md:inline font-medium">
                  {sheetsConfig?.isConnected ? 'Sheets Synced' : 'Sheets Setup'}
                </span>
                <span className={`w-2 h-2 rounded-full ${sheetsConfig?.isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              </button>
            )}

            {/* PWA Install Button */}
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-colors"
                title="Install app to your desktop or device"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center justify-center text-xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-medium text-slate-200 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <span>@{currentUser.username}</span>
                  <span>•</span>
                  <span className={isAdmin ? 'text-indigo-400 font-semibold' : 'text-slate-400'}>
                    {isAdmin ? 'Admin' : 'Team Member'}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Settings / Change Password */}
            <button
              onClick={onChangePasswordClick}
              title="Change Password"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none text-xs border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('quick-entry')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'quick-entry'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Quick Entry</span>
          </button>

          <button
            onClick={() => setActiveTab('entries')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'entries'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Invoice Log Entries</span>
          </button>

          {!isAdmin && (
            <button
              onClick={() => setActiveTab('my-requests')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === 'my-requests'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>My Correction Requests</span>
            </button>
          )}

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('correction-requests')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'correction-requests'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Correction Queue</span>
              </button>

              <button
                onClick={() => setActiveTab('password-resets')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'password-resets'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Password Reset Queue</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'users'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Manage Users</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Executive Dashboard</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
