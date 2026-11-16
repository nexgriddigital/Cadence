import { CreditCard, Pencil } from 'lucide-react';
import type { Recruit } from '../types/payroll';
import {
  type PaymentMethodSummary,
  formatCurrency,
} from '../utils/commissionEngine';

interface PaymentMethodsViewProps {
  breakdown: PaymentMethodSummary[];
  recruits: Recruit[];
  onEditRecruit: (recruit: Recruit) => void;
}

const RAIL_DESCRIPTIONS: Record<string, string> = {
  'ACH Direct Deposit': 'Domestic bank-to-bank clearing (1–2 business days)',
  'Wire Transfer': 'Same-day high-value bank wire settlement',
  Wise: 'International multi-currency transfer rail',
  PayPal: 'Instant digital wallet payout',
  Check: 'Physical check disbursement',
};

export function PaymentMethodsView({
  breakdown,
  recruits,
  onEditRecruit,
}: PaymentMethodsViewProps) {
  return (
    <div className="space-y-6">
      {/* Rail Summary Grid */}
      <section aria-label="Payment rail volume breakdown" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {breakdown.map((item) => (
          <div
            key={item.method}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  {item.method}
                </h2>
                <CreditCard className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {RAIL_DESCRIPTIONS[item.method] ?? 'Configured payment rail'}
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <p className="text-[11px] text-slate-500">Employee Volume</p>
                <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(item.employeeVolume)}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="text-[11px] text-slate-500">
                  {item.payoutCount} payout{item.payoutCount === 1 ? '' : 's'}
                </p>
                <p className="font-mono text-xs font-medium text-blue-700">
                  {formatCurrency(item.recruiterEarnings)} earned
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Accounts On File Per Recruit */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Recruit Payment Accounts on File
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Default payment methods and masked payout destinations automatically prefilled when recording payouts
          </p>
        </div>

        {recruits.length === 0 ? (
          <div className="py-12 px-6 text-center text-sm text-slate-500">
            No recruited employees on file yet. Add a recruit to configure their preferred payment method and payout destination.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Recruited Employee</th>
                  <th className="py-3 px-4">Preferred Payment Method</th>
                  <th className="py-3 px-4">Account / Destination</th>
                  <th className="py-3 px-4">Email Contact</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recruits.map((recruit) => (
                  <tr
                    key={recruit.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-900">{recruit.name}</div>
                      <div className="text-xs text-slate-500">
                        {recruit.role} · {recruit.company}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {recruit.preferredPaymentMethod}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      {recruit.paymentAccountDetail}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {recruit.email}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onEditRecruit(recruit)}
                        aria-label={`Update payment method for ${recruit.name}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Update Method</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
