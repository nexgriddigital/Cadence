import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, UserPlus } from 'lucide-react';
import type { CommissionRuleSet, Recruit } from '../types/payroll';
import {
  type RecruitEarningsSummary,
  formatCurrency,
  formatDateShort,
} from '../utils/commissionEngine';

interface RecruitsViewProps {
  recruitSummaries: RecruitEarningsSummary[];
  rules: CommissionRuleSet;
  onAddRecruit: () => void;
  onEditRecruit: (recruit: Recruit) => void;
  onRecordPayoutForRecruit: (recruitId: string) => void;
}

export function RecruitsView({
  recruitSummaries,
  rules,
  onAddRecruit,
  onEditRecruit,
  onRecordPayoutForRecruit,
}: RecruitsViewProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recruitSummaries;
    return recruitSummaries.filter(({ recruit }) =>
      [
        recruit.name,
        recruit.role,
        recruit.company,
        recruit.preferredPaymentMethod,
        recruit.paymentAccountDetail,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [recruitSummaries, search]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recruited employees..."
            aria-label="Search recruited employees"
            className="pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 w-64"
          />
        </div>

        <button
          type="button"
          onClick={onAddRecruit}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <span>Add Recruit</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <p className="text-sm font-medium text-slate-900">
              {recruitSummaries.length === 0
                ? 'No recruited employees added yet'
                : 'No recruits match your search'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Add recruited employees with their commission structure and preferred payment method.
            </p>
            <div className="mt-4">
              {recruitSummaries.length === 0 ? (
                <button
                  type="button"
                  onClick={onAddRecruit}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  Add First Recruit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 whitespace-nowrap">
                  <th className="py-3 px-5">Employee & Placement</th>
                  <th className="py-3 px-4">Commission Structure</th>
                  <th className="py-3 px-4">Payment Method on File</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">Commission + Bonus</th>
                  <th className="py-3 px-4">Last Paid</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((summary) => {
                  const { recruit } = summary;
                  const rateLabel =
                    recruit.commissionModel === 'flat'
                      ? `${formatCurrency(recruit.customCommissionValue ?? 0)} flat / cycle`
                      : recruit.customCommissionValue !== null
                        ? `${recruit.customCommissionValue}% custom rate`
                        : `${rules.defaultCommissionRatePct}% default rate`;

                  return (
                    <tr
                      key={recruit.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-900">
                          {recruit.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {recruit.role} · {recruit.company}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        <div>{rateLabel}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          Started {formatDateShort(recruit.startDate)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800 whitespace-nowrap">
                          {recruit.preferredPaymentMethod}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {recruit.paymentAccountDetail}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-800 tabular-nums whitespace-nowrap">
                        <div>{formatCurrency(summary.totalEmployeePaid)}</div>
                        <div className="text-[11px] text-slate-500">
                          {summary.payoutCount} payout{summary.payoutCount === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(summary.totalRecruiterEarnings)}
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          {formatCurrency(summary.totalBonuses)} in bonuses
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {summary.lastPayDate ? formatDateShort(summary.lastPayDate) : '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onRecordPayoutForRecruit(recruit.id)}
                            aria-label={`Record payout for ${recruit.name}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Log Pay</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditRecruit(recruit)}
                            aria-label={`Edit ${recruit.name}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
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
    </div>
  );
}
