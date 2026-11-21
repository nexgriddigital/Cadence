import { Menu, Plus } from 'lucide-react';
import type { DashboardTab } from '../types/payroll';

interface TopBarProps {
  activeTab: DashboardTab;
  onOpenMobileMenu: () => void;
  onOpenRecordPayout: () => void;
}

const TAB_TITLES: Record<DashboardTab, string> = {
  overview: 'Overview',
  ledger: 'Payout Ledger',
  applicants: 'Applicants',
  forms: 'Google Forms Screening Exam',
  recruits: 'Recruited Employees',
  'payment-methods': 'Payment Methods',
  rules: 'Commission & Bonus Rules',
};

export function TopBar({
  activeTab,
  onOpenMobileMenu,
  onOpenRecordPayout,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
            Payroll & Commissions
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display text-base font-semibold text-slate-900 truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenRecordPayout}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Record Payout</span>
        </button>
      </div>
    </header>
  );
}
