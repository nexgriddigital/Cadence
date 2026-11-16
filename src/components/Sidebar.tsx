import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Receipt,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import type { DashboardTab } from '../types/payroll';

interface SidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  pendingCount: number;
  recruitCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userDisplayName?: string | null;
  userEmail?: string | null;
  onSignOut?: () => void;
}

const NAV_ITEMS: Array<{
  id: DashboardTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'ledger', label: 'Payout Ledger', icon: Receipt },
  { id: 'recruits', label: 'Recruits', icon: Users },
  { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
  { id: 'rules', label: 'Commission Rules', icon: SlidersHorizontal },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  pendingCount,
  recruitCount,
  mobileOpen,
  onCloseMobile,
  userDisplayName,
  userEmail,
  onSignOut,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
          Cadence
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const countText =
            item.id === 'ledger' && pendingCount > 0
              ? `${pendingCount}`
              : item.id === 'recruits'
                ? `${recruitCount}`
                : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-700' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </span>
              {countText !== null && (
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {countText}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-200 space-y-2">
        {(userDisplayName || userEmail) && (
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <div className="text-xs font-medium text-slate-900 truncate">
              {userDisplayName || 'Signed-in Recruiter'}
            </div>
            {userEmail && (
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {userEmail}
              </div>
            )}
          </div>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block shrink-0">{navContent}</aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 flex h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
}
