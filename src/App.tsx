import React, { useState, useEffect } from 'react';
import { User, SheetsConfig } from './types';
import { api, getStoredToken, setStoredToken, clearStoredToken } from './lib/api';

import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { ForcedPasswordChangeModal } from './components/ForcedPasswordChangeModal';
import { QuickEntryForm } from './components/QuickEntryForm';
import { EntriesList } from './components/EntriesList';
import { MyCorrectionRequests } from './components/MyCorrectionRequests';
import { AdminCorrectionRequests } from './components/AdminCorrectionRequests';
import { AdminPasswordResets } from './components/AdminPasswordResets';
import { AdminUserManagement } from './components/AdminUserManagement';
import { DashboardView } from './components/DashboardView';
import { AuditHistoryModal } from './components/AuditHistoryModal';
import { SheetsConfigModal } from './components/SheetsConfigModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Active navigation tab (default: quick-entry)
  const [activeTab, setActiveTab] = useState<string>('quick-entry');

  // Sheets Config state
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);

  // Global modals
  const [auditModalInfo, setAuditModalInfo] = useState<{ entryId: string; invoiceNumber: string } | null>(null);
  const [showSheetsConfigModal, setShowSheetsConfigModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Trigger to force refresh entries list
  const [refreshEntriesCount, setRefreshEntriesCount] = useState(0);

  // Check auth on startup
  useEffect(() => {
    async function checkAuth() {
      const token = getStoredToken();
      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        const meRes = await api.getMe();
        setCurrentUser(meRes.user);

        // Fetch Sheets Config
        if (meRes.user.role === 'admin') {
          const configRes = await api.getSheetsConfig().catch(() => null);
          if (configRes) setSheetsConfig(configRes.config);
        }
      } catch {
        clearStoredToken();
        setCurrentUser(null);
      } finally {
        setInitializing(false);
      }
    }

    checkAuth();
  }, []);

  const handleLoginSuccess = async (user: User, token: string) => {
    setStoredToken(token);
    setCurrentUser(user);

    if (user.role === 'admin') {
      const configRes = await api.getSheetsConfig().catch(() => null);
      if (configRes) setSheetsConfig(configRes.config);
    }
  };

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    clearStoredToken();
    setCurrentUser(null);
    setActiveTab('quick-entry');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <div className="text-xs text-slate-400 font-medium">Initializing Invoice Issue Tracker...</div>
      </div>
    );
  }

  // Render Login Screen if unauthenticated
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Forced password change interceptor
  if (currentUser.must_reset_password) {
    return (
      <ForcedPasswordChangeModal
        currentUser={currentUser}
        onSuccess={(updatedUser) => {
          setCurrentUser(updatedUser);
        }}
      />
    );
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header & Navigation */}
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onChangePasswordClick={() => setShowChangePasswordModal(true)}
        onOpenSheetsConfig={() => setShowSheetsConfigModal(true)}
        sheetsConfig={sheetsConfig}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        {activeTab === 'quick-entry' && (
          <QuickEntryForm
            currentUser={currentUser}
            onEntryAdded={() => {
              setRefreshEntriesCount((prev) => prev + 1);
            }}
            onViewEntries={() => setActiveTab('entries')}
          />
        )}

        {activeTab === 'entries' && (
          <EntriesList
            currentUser={currentUser}
            refreshTrigger={refreshEntriesCount}
            onOpenAuditModal={(entryId, invoiceNumber) => {
              setAuditModalInfo({ entryId, invoiceNumber });
            }}
          />
        )}

        {activeTab === 'my-requests' && !isAdmin && (
          <MyCorrectionRequests />
        )}

        {activeTab === 'correction-requests' && isAdmin && (
          <AdminCorrectionRequests />
        )}

        {activeTab === 'password-resets' && isAdmin && (
          <AdminPasswordResets />
        )}

        {activeTab === 'users' && isAdmin && (
          <AdminUserManagement />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView currentUser={currentUser} />
        )}
      </main>

      {/* Global Modals */}
      {auditModalInfo && (
        <AuditHistoryModal
          entryId={auditModalInfo.entryId}
          invoiceNumber={auditModalInfo.invoiceNumber}
          onClose={() => setAuditModalInfo(null)}
        />
      )}

      {showSheetsConfigModal && (
        <SheetsConfigModal
          onClose={() => setShowSheetsConfigModal(false)}
          onConfigUpdated={(updatedConfig) => {
            setSheetsConfig(updatedConfig);
          }}
        />
      )}

      {showChangePasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowChangePasswordModal(false)}
        />
      )}
    </div>
  );
}
