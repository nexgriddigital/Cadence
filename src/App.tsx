import { useMemo, useState } from 'react';
import type { DashboardTab, PayoutRecord, Recruit } from './types/payroll';
import { FirebaseProvider, useFirebaseAuth } from './contexts/FirebaseContext';
import { usePayrollStore } from './hooks/usePayrollStore';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewView } from './components/OverviewView';
import { LedgerView } from './components/LedgerView';
import { RecruitsView } from './components/RecruitsView';
import { PaymentMethodsView } from './components/PaymentMethodsView';
import { RulesView } from './components/RulesView';
import { RecordPayoutModal } from './components/RecordPayoutModal';
import { RecruitModal } from './components/RecruitModal';
import { PayoutDetailDrawer } from './components/PayoutDetailDrawer';

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading workspace data">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 animate-pulse"
          >
            <div className="h-3 w-28 bg-slate-100 rounded" />
            <div className="h-7 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-36 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 h-80 animate-pulse">
          <div className="h-4 w-48 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-64 bg-slate-100 rounded mb-6" />
          <div className="h-52 bg-slate-100 rounded-lg" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 h-80 animate-pulse space-y-4">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-3 w-48 bg-slate-100 rounded" />
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthenticatedWorkspace() {
  const { user, signOutUser } = useFirebaseAuth();
  const {
    recruits,
    payouts,
    rules,
    performanceTargets,
    loading,
    syncError,
    recruitsMap,
    metrics,
    recordPayout,
    updatePayoutStatus,
    updatePayoutNotes,
    deletePayout,
    addRecruit,
    updateRecruit,
    updateRules,
    savePerformanceTarget,
  } = usePayrollStore();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals & Drawers
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [preselectedRecruitId, setPreselectedRecruitId] = useState<string | null>(
    null
  );
  const [recruitModalOpen, setRecruitModalOpen] = useState(false);
  const [editingRecruit, setEditingRecruit] = useState<Recruit | null>(null);
  const [inspectedPayoutId, setInspectedPayoutId] = useState<string | null>(null);

  const inspectedPayout: PayoutRecord | null = useMemo(() => {
    if (!inspectedPayoutId) return null;
    return payouts.find((p) => p.id === inspectedPayoutId) ?? null;
  }, [payouts, inspectedPayoutId]);

  const openRecordPayoutModal = (recruitId?: string) => {
    setPreselectedRecruitId(recruitId ?? null);
    setPayoutModalOpen(true);
  };

  const openAddRecruitModal = () => {
    setEditingRecruit(null);
    setRecruitModalOpen(true);
  };

  const openEditRecruitModal = (recruit: Recruit) => {
    setEditingRecruit(recruit);
    setRecruitModalOpen(true);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={metrics.pendingSettlementsCount}
        recruitCount={recruits.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        userDisplayName={user?.displayName}
        userEmail={user?.email}
        onSignOut={() => void signOutUser()}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenRecordPayout={() => openRecordPayoutModal()}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto space-y-6">
          {syncError && (
            <div
              role="alert"
              className="p-3.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl"
            >
              {syncError}
            </div>
          )}

          {loading ? (
            <WorkspaceSkeleton />
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  metrics={metrics}
                  payouts={payouts}
                  recruitsMap={recruitsMap}
                  onMarkPaid={(id) => void updatePayoutStatus(id, 'Paid')}
                  onInspectPayout={(p) => setInspectedPayoutId(p.id)}
                  onNavigateTab={setActiveTab}
                  onOpenRecordPayout={() => openRecordPayoutModal()}
                />
              )}

              {activeTab === 'ledger' && (
                <LedgerView
                  payouts={payouts}
                  recruitsMap={recruitsMap}
                  onMarkPaid={(id) => void updatePayoutStatus(id, 'Paid')}
                  onInspectPayout={(p) => setInspectedPayoutId(p.id)}
                  onOpenRecordPayout={() => openRecordPayoutModal()}
                />
              )}

              {activeTab === 'recruits' && (
                <RecruitsView
                  recruitSummaries={metrics.recruitSummaries}
                  rules={rules}
                  onAddRecruit={openAddRecruitModal}
                  onEditRecruit={openEditRecruitModal}
                  onRecordPayoutForRecruit={(id) => openRecordPayoutModal(id)}
                />
              )}

              {activeTab === 'payment-methods' && (
                <PaymentMethodsView
                  breakdown={metrics.paymentMethodBreakdown}
                  recruits={recruits}
                  onEditRecruit={openEditRecruitModal}
                />
              )}

              {activeTab === 'rules' && (
                <RulesView
                  rules={rules}
                  recruits={recruits}
                  payouts={payouts}
                  performanceTargets={performanceTargets}
                  onSaveRules={(nextRules) => void updateRules(nextRules)}
                  onSavePerformanceTarget={(input) =>
                    void savePerformanceTarget(input)
                  }
                />
              )}
            </>
          )}
        </main>
      </div>

      <RecordPayoutModal
        open={payoutModalOpen}
        recruits={recruits}
        payouts={payouts}
        rules={rules}
        performanceTargets={performanceTargets}
        initialRecruitId={preselectedRecruitId}
        onClose={() => setPayoutModalOpen(false)}
        onSubmit={(input) => {
          void recordPayout(input);
        }}
        onRequestAddRecruit={() => {
          setPayoutModalOpen(false);
          openAddRecruitModal();
        }}
      />

      <RecruitModal
        open={recruitModalOpen}
        editingRecruit={editingRecruit}
        rules={rules}
        onClose={() => setRecruitModalOpen(false)}
        onSave={(input, existingId) => {
          if (existingId) {
            void updateRecruit(existingId, input);
          } else {
            void addRecruit(input);
          }
        }}
      />

      <PayoutDetailDrawer
        payout={inspectedPayout}
        recruit={
          inspectedPayout ? recruitsMap.get(inspectedPayout.recruitId) ?? null : null
        }
        onClose={() => setInspectedPayoutId(null)}
        onUpdateStatus={(id, status) => void updatePayoutStatus(id, status)}
        onUpdateNotes={(id, notes) => void updatePayoutNotes(id, notes)}
        onDelete={(id) => void deletePayout(id)}
      />
    </div>
  );
}

function AppGate() {
  const { user, authReady } = useFirebaseAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <div className="font-display text-lg font-bold tracking-tight text-slate-900">
            Cadence
          </div>
          <p className="text-sm text-slate-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedWorkspace />;
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppGate />
    </FirebaseProvider>
  );
}
