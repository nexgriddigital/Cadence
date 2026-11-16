import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CommissionRuleSet,
  PaymentMethodType,
  PayoutRecord,
  PayoutStatus,
  PerformanceTarget,
  Recruit,
} from '../types/payroll';
import type { NewPayoutInput } from '../hooks/usePayrollStore';
import {
  PAYMENT_METHOD_TYPES,
  calculatePayoutBreakdown,
  formatCurrency,
  getPriorCumulativePay,
  resolvePayoutCommissionMultiplier,
} from '../utils/commissionEngine';

interface RecordPayoutModalProps {
  open: boolean;
  recruits: Recruit[];
  payouts: PayoutRecord[];
  rules: CommissionRuleSet;
  performanceTargets: PerformanceTarget[];
  initialRecruitId?: string | null;
  onClose: () => void;
  onSubmit: (input: NewPayoutInput) => void;
  onRequestAddRecruit: () => void;
}

export function RecordPayoutModal({
  open,
  recruits,
  payouts,
  rules,
  performanceTargets,
  initialRecruitId,
  onClose,
  onSubmit,
  onRequestAddRecruit,
}: RecordPayoutModalProps) {
  const defaultRecruit = recruits[0];
  const [recruitId, setRecruitId] = useState(
    initialRecruitId ?? defaultRecruit?.id ?? ''
  );
  const [grossPay, setGrossPay] = useState('');
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [payPeriodLabel, setPayPeriodLabel] = useState(() =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(new Date())
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(
    defaultRecruit?.preferredPaymentMethod ?? 'ACH Direct Deposit'
  );
  const [paymentAccountDetail, setPaymentAccountDetail] = useState(
    defaultRecruit?.paymentAccountDetail ?? ''
  );
  const [status, setStatus] = useState<PayoutStatus>('Paid');
  const [isRetentionMilestone, setIsRetentionMilestone] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Sync when modal opens or initialRecruitId changes
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const target =
      recruits.find((r) => r.id === initialRecruitId) ?? recruits[0];
    if (target) {
      setRecruitId(target.id);
      setPaymentMethod(target.preferredPaymentMethod);
      setPaymentAccountDetail(target.paymentAccountDetail);
    } else {
      setRecruitId('');
      setPaymentAccountDetail('');
    }
    setPayDate(now.toISOString().slice(0, 10));
    setPayPeriodLabel(
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
      }).format(now)
    );
    setGrossPay('');
    setIsRetentionMilestone(false);
    setNotes('');
    setStatus('Paid');
    setError('');
  }, [open, initialRecruitId, recruits]);

  const selectedRecruit = useMemo(
    () => recruits.find((r) => r.id === recruitId) ?? null,
    [recruits, recruitId]
  );

  const handleRecruitChange = (nextId: string) => {
    setRecruitId(nextId);
    const found = recruits.find((r) => r.id === nextId);
    if (found) {
      setPaymentMethod(found.preferredPaymentMethod);
      setPaymentAccountDetail(found.paymentAccountDetail);
    }
  };

  const liveBreakdown = useMemo(() => {
    if (!selectedRecruit) return null;
    const parsedPay = Number(grossPay);
    if (!Number.isFinite(parsedPay) || parsedPay <= 0) return null;

    const prior = getPriorCumulativePay(payouts, selectedRecruit.id);
    const multiplier = resolvePayoutCommissionMultiplier({
      recruitId: selectedRecruit.id,
      payDate,
      grossEmployeePay: parsedPay,
      payouts,
      targets: performanceTargets,
    });
    return calculatePayoutBreakdown({
      grossEmployeePay: parsedPay,
      recruit: selectedRecruit,
      rules,
      priorCumulativeEmployeePay: prior,
      isRetentionMilestone,
      commissionMultiplier: multiplier,
    });
  }, [
    selectedRecruit,
    grossPay,
    payDate,
    payouts,
    rules,
    performanceTargets,
    isRetentionMilestone,
  ]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecruit) {
      setError('Please select or add a recruited employee.');
      return;
    }
    const parsedPay = Number(grossPay);
    if (!Number.isFinite(parsedPay) || parsedPay <= 0 || parsedPay > 10000000) {
      setError('Enter a valid employee payout amount between Br 0.01 and Br 10,000,000.');
      return;
    }
    if (!payDate) {
      setError('Please select a pay date.');
      return;
    }
    if (!payPeriodLabel.trim()) {
      setError('Please enter a pay period label.');
      return;
    }
    if (!paymentAccountDetail.trim()) {
      setError('Enter the payment account or destination reference.');
      return;
    }

    setError('');
    onSubmit({
      recruitId: selectedRecruit.id,
      payDate,
      payPeriodLabel,
      grossEmployeePay: parsedPay,
      paymentMethod,
      paymentAccountDetail,
      status,
      isRetentionMilestone,
      notes,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payout-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="record-payout-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              Record Employee Payout
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Commission and milestone bonuses are calculated automatically
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close record payout modal"
            className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="payout-recruit"
                className="block text-xs font-medium text-slate-700"
              >
                Recruited Employee
              </label>
              <button
                type="button"
                onClick={onRequestAddRecruit}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                + New Recruit
              </button>
            </div>
            <select
              id="payout-recruit"
              value={recruitId}
              onChange={(e) => handleRecruitChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              {recruits.length === 0 ? (
                <option value="">No recruits available</option>
              ) : (
                recruits.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.role} ({r.company})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="payout-gross-amount"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Amount Paid to Employee (ETB / Br)
              </label>
              <input
                id="payout-gross-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 4800"
                value={grossPay}
                onChange={(e) => {
                  setGrossPay(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="payout-date"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Pay Date
              </label>
              <input
                id="payout-date"
                type="date"
                value={payDate}
                onChange={(e) => {
                  setPayDate(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="payout-period"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Pay Period
              </label>
              <input
                id="payout-period"
                type="text"
                maxLength={80}
                value={payPeriodLabel}
                onChange={(e) => {
                  setPayPeriodLabel(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Nov 1 – Nov 15, 2026"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="payout-status"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Settlement Status
              </label>
              <select
                id="payout-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PayoutStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                <option value="Paid">Paid</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Pending">Pending</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="payout-method"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Payment Method
              </label>
              <select
                id="payout-method"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethodType)
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {PAYMENT_METHOD_TYPES.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="payout-account"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Account / Destination
              </label>
              <input
                id="payout-account"
                type="text"
                maxLength={160}
                value={paymentAccountDetail}
                onChange={(e) => {
                  setPaymentAccountDetail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Chase Checking ••4821"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isRetentionMilestone}
              onChange={(e) => setIsRetentionMilestone(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              Mark as 90-Day Retention Milestone (+
              {formatCurrency(rules.retentionMilestoneBonusAmount)} automatic bonus)
            </span>
          </label>

          {/* Live Auto-Calculation Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Automatic Commission & Bonus Preview</span>
              {selectedRecruit && (
                <span className="font-mono text-slate-500 font-normal">
                  {selectedRecruit.commissionModel === 'flat'
                    ? `${formatCurrency(selectedRecruit.customCommissionValue ?? 0)} flat`
                    : `${selectedRecruit.customCommissionValue ?? rules.defaultCommissionRatePct}% rate`}
                </span>
              )}
            </div>

            {liveBreakdown ? (
              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Base Commission</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {formatCurrency(liveBreakdown.baseCommissionAmount)}
                  </span>
                </div>
                {liveBreakdown.bonuses.map((bonus) => (
                  <div
                    key={bonus.id}
                    className="flex items-center justify-between text-emerald-700"
                  >
                    <span>{bonus.label}</span>
                    <span className="font-mono font-medium tabular-nums">
                      +{formatCurrency(bonus.amount)}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-semibold text-slate-900">
                  <span>Your Total Earnings</span>
                  <span className="font-mono text-blue-700 tabular-nums">
                    {formatCurrency(liveBreakdown.totalRecruiterEarnings)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Enter an employee payout amount above to preview your commission and triggered bonuses.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="payout-notes"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Notes (Optional)
            </label>
            <input
              id="payout-notes"
              type="text"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Includes Q4 placement bonus"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Save Payout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
