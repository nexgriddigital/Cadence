import { useEffect, useState } from 'react';
import { FileText, Trash2, X } from 'lucide-react';
import type { PayoutRecord, PayoutStatus, Recruit } from '../types/payroll';
import { formatCurrency, formatDateShort } from '../utils/commissionEngine';
import { exportPayoutReceiptToPdf } from '../utils/pdfExport';
import { StatusLabel } from './StatusLabel';

interface PayoutDetailDrawerProps {
  payout: PayoutRecord | null;
  recruit: Recruit | null;
  onClose: () => void;
  onUpdateStatus: (payoutId: string, status: PayoutStatus) => void;
  onUpdateNotes: (payoutId: string, notes: string) => void;
  onDelete: (payoutId: string) => void;
}

const STATUS_CHOICES: PayoutStatus[] = ['Paid', 'Scheduled', 'Pending', 'On Hold'];

export function PayoutDetailDrawer({
  payout,
  recruit,
  onClose,
  onUpdateStatus,
  onUpdateNotes,
  onDelete,
}: PayoutDetailDrawerProps) {
  const [notesDraft, setNotesDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (payout) {
      setNotesDraft(payout.notes);
    }
  }, [payout?.id, payout?.notes]);

  useEffect(() => {
    setConfirmDelete(false);
  }, [payout?.id]);

  if (!payout) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-payout-title"
    >
      <div className="bg-white border-l border-slate-200 w-full max-w-md h-full overflow-y-auto flex flex-col justify-between shadow-2xl">
        <div>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-slate-500">
                {payout.referenceCode} · {formatDateShort(payout.payDate)}
              </p>
              <h2
                id="drawer-payout-title"
                className="font-display text-base font-semibold text-slate-900 mt-0.5"
              >
                {recruit?.name ?? 'Unknown Recruit'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close payout details"
              className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Key Totals */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Status</span>
                <StatusLabel status={payout.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Employee Paid</span>
                <span className="font-mono text-sm font-medium text-slate-900 tabular-nums">
                  {formatCurrency(payout.grossEmployeePay)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Pay Period</span>
                <span className="text-xs font-medium text-slate-800">
                  {payout.payPeriodLabel}
                </span>
              </div>
            </div>

            {/* Commission & Bonus Breakdown */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 mb-3">
                Automatic Earnings Breakdown
              </h3>
              <div className="space-y-2.5 text-xs border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-slate-700">
                  <span>
                    Base Commission (
                    {payout.commissionModel === 'flat'
                      ? `${formatCurrency(payout.commissionRateOrFlat)} flat`
                      : `${payout.commissionRateOrFlat}%`}
                    )
                  </span>
                  <span className="font-mono font-medium text-slate-900 tabular-nums">
                    {formatCurrency(payout.baseCommissionAmount)}
                  </span>
                </div>

                {payout.bonuses.length === 0 ? (
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Triggered Bonuses</span>
                    <span className="font-mono">Br 0.00</span>
                  </div>
                ) : (
                  payout.bonuses.map((bonus) => (
                    <div
                      key={bonus.id}
                      className="flex items-center justify-between gap-2 text-emerald-700"
                    >
                      <span>{bonus.label}</span>
                      <span className="font-mono font-medium tabular-nums shrink-0">
                        +{formatCurrency(bonus.amount)}
                      </span>
                    </div>
                  ))
                )}

                <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm font-semibold text-slate-900">
                  <span>Total Earned</span>
                  <span className="font-mono text-blue-700 tabular-nums">
                    {formatCurrency(payout.totalRecruiterEarnings)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 mb-2">
                Payment Method Details
              </h3>
              <div className="border border-slate-200 rounded-xl p-4 space-y-1 text-xs">
                <div className="font-medium text-slate-900">
                  {payout.paymentMethod}
                </div>
                <div className="font-mono text-slate-600">
                  {payout.paymentAccountDetail}
                </div>
                {recruit && (
                  <div className="text-slate-500 pt-1">
                    {recruit.role} · {recruit.company}
                  </div>
                )}
              </div>
            </div>

            {/* Status Update */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900 mb-2">
                Update Settlement Status
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_CHOICES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onUpdateStatus(payout.id, st)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      payout.status === st
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Note */}
            <div>
              <label
                htmlFor="drawer-notes"
                className="block text-xs font-semibold text-slate-900 mb-2"
              >
                Ledger Note
              </label>
              <textarea
                id="drawer-notes"
                rows={3}
                maxLength={500}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => {
                  if (notesDraft !== payout.notes) {
                    onUpdateNotes(payout.id, notesDraft);
                  }
                }}
                placeholder="Add payment confirmation or adjustment note..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Footer Delete */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          {confirmDelete ? (
            <div className="flex items-center justify-between w-full gap-2">
              <span className="text-xs font-medium text-red-700">
                Delete this payout record?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(payout.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Remove Entry</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportPayoutReceiptToPdf(payout, recruit)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
