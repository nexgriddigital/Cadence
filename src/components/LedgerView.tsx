import { useMemo, useState } from 'react';
import { Check, Download, FileText, Search, X } from 'lucide-react';
import type {
  PaymentMethodType,
  PayoutFilters,
  PayoutRecord,
  PayoutStatus,
  Recruit,
} from '../types/payroll';
import {
  PAYMENT_METHOD_TYPES,
  exportPayoutsToCsv,
  filterPayouts,
  formatCurrency,
  formatDateShort,
} from '../utils/commissionEngine';
import { exportLedgerToPdf } from '../utils/pdfExport';
import { StatusLabel } from './StatusLabel';

interface LedgerViewProps {
  payouts: PayoutRecord[];
  recruitsMap: Map<string, Recruit>;
  onMarkPaid: (payoutId: string) => void;
  onInspectPayout: (payout: PayoutRecord) => void;
  onOpenRecordPayout: () => void;
}

const STATUS_OPTIONS: Array<PayoutStatus | 'All'> = [
  'All',
  'Paid',
  'Scheduled',
  'Pending',
  'On Hold',
];

export function LedgerView({
  payouts,
  recruitsMap,
  onMarkPaid,
  onInspectPayout,
  onOpenRecordPayout,
}: LedgerViewProps) {
  const [filters, setFilters] = useState<PayoutFilters>({
    search: '',
    status: 'All',
    paymentMethod: 'All',
    sortBy: 'date-desc',
  });

  const filtered = useMemo(
    () => filterPayouts(payouts, recruitsMap, filters),
    [payouts, recruitsMap, filters]
  );

  const summary = useMemo(() => {
    const gross = filtered.reduce((s, p) => s + p.grossEmployeePay, 0);
    const comm = filtered.reduce((s, p) => s + p.baseCommissionAmount, 0);
    const bonus = filtered.reduce((s, p) => s + p.totalBonusAmount, 0);
    const total = filtered.reduce((s, p) => s + p.totalRecruiterEarnings, 0);
    return { gross, comm, bonus, total };
  }, [filtered]);

  const handleExportCsv = () => {
    const csv = exportPayoutsToCsv(filtered, recruitsMap);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cadence-payout-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    exportLedgerToPdf(filtered, recruitsMap, filters);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <label htmlFor="ledger-search-input" className="sr-only">
              Search payouts by recruit name, ID, or payment status
            </label>
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="ledger-search-input"
              type="search"
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Search by recruit, ID, or status..."
              aria-label="Search payouts by recruit name, ID, or payment status"
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Filter ledger by status"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
          >
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, status }))}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  filters.status === status
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="ledger-method-filter">
            Filter by payment method
          </label>
          <select
            id="ledger-method-filter"
            value={filters.paymentMethod}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                paymentMethod: e.target.value as PaymentMethodType | 'All',
              }))
            }
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          >
            <option value="All">All Payment Methods</option>
            {PAYMENT_METHOD_TYPES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="ledger-sort">
            Sort payouts
          </label>
          <select
            id="ledger-sort"
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                sortBy: e.target.value as PayoutFilters['sortBy'],
              }))
            }
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Highest Employee Pay</option>
            <option value="earnings-desc">Highest Commission Earned</option>
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <p className="text-sm font-medium text-slate-900">
              No payouts match the current view
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {payouts.length === 0
                ? 'Start recording payments made to recruited employees to track commissions automatically.'
                : 'Clear your search or filter selections to view all entries.'}
            </p>
            <div className="mt-4">
              {payouts.length === 0 ? (
                <button
                  type="button"
                  onClick={onOpenRecordPayout}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  Record First Payout
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      search: '',
                      status: 'All',
                      paymentMethod: 'All',
                      sortBy: 'date-desc',
                    })
                  }
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 whitespace-nowrap">
                    <th className="py-3 px-4">Ref</th>
                    <th className="py-3 px-4">Recruited Employee</th>
                    <th className="py-3 px-4">Pay Date & Period</th>
                    <th className="py-3 px-4 text-right">Employee Paid</th>
                    <th className="py-3 px-4 text-right">Base Commission</th>
                    <th className="py-3 px-4 text-right">Auto Bonus</th>
                    <th className="py-3 px-4 text-right">Total Earned</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((payout) => {
                    const recruit = recruitsMap.get(payout.recruitId);
                    return (
                      <tr
                        key={payout.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {payout.referenceCode}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => onInspectPayout(payout)}
                            className="text-left group focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                          >
                            <div className="font-medium text-slate-900 group-hover:text-blue-700">
                              {recruit?.name ?? 'Unknown Recruit'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {recruit?.role ?? '—'} · {recruit?.company ?? '—'}
                            </div>
                          </button>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-xs font-medium text-slate-800 tabular-nums">
                            {formatDateShort(payout.payDate)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {payout.payPeriodLabel}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-800 tabular-nums whitespace-nowrap">
                          {formatCurrency(payout.grossEmployeePay)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                          <div>{formatCurrency(payout.baseCommissionAmount)}</div>
                          <div className="text-[11px] text-slate-400">
                            {payout.commissionModel === 'flat'
                              ? 'Flat fee'
                              : `${payout.commissionRateOrFlat}% rate`}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          {payout.totalBonusAmount > 0 ? (
                            <div>
                              <span className="text-emerald-700 font-medium">
                                +{formatCurrency(payout.totalBonusAmount)}
                              </span>
                              <div className="text-[11px] text-slate-400">
                                {payout.bonuses.length} rule{payout.bonuses.length > 1 ? 's' : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(payout.totalRecruiterEarnings)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-medium text-slate-800 whitespace-nowrap">
                            {payout.paymentMethod}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[165px]">
                            {payout.paymentAccountDetail}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel status={payout.status} />
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {(payout.status === 'Pending' ||
                              payout.status === 'Scheduled') && (
                              <button
                                type="button"
                                onClick={() => onMarkPaid(payout.id)}
                                aria-label={`Mark ${payout.referenceCode} as Paid`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Mark Paid</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onInspectPayout(payout)}
                              aria-label={`Inspect ${payout.referenceCode}`}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900">
                    <td colSpan={3} className="py-3 px-5">
                      Filtered Totals ({filtered.length}{' '}
                      {filtered.length === 1 ? 'entry' : 'entries'})
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(summary.gross)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(summary.comm)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 tabular-nums">
                      +{formatCurrency(summary.bonus)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatCurrency(summary.total)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
