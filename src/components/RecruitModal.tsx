import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CommissionModel,
  CommissionRuleSet,
  PaymentMethodType,
  Recruit,
} from '../types/payroll';
import type { RecruitInput } from '../hooks/usePayrollStore';
import { PAYMENT_METHOD_TYPES } from '../utils/commissionEngine';

interface RecruitModalProps {
  open: boolean;
  editingRecruit: Recruit | null;
  rules: CommissionRuleSet;
  onClose: () => void;
  onSave: (input: RecruitInput, existingId?: string) => void;
}

export function RecruitModal({
  open,
  editingRecruit,
  rules,
  onClose,
  onSave,
}: RecruitModalProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [startDate, setStartDate] = useState(todayIso);
  const [commissionModel, setCommissionModel] =
    useState<CommissionModel>('percentage');
  const [customValue, setCustomValue] = useState('');
  const [preferredPaymentMethod, setPreferredPaymentMethod] =
    useState<PaymentMethodType>('ACH Direct Deposit');
  const [paymentAccountDetail, setPaymentAccountDetail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editingRecruit) {
      setName(editingRecruit.name);
      setRole(editingRecruit.role);
      setCompany(editingRecruit.company);
      setEmail(editingRecruit.email);
      setStartDate(editingRecruit.startDate);
      setCommissionModel(editingRecruit.commissionModel);
      setCustomValue(
        editingRecruit.customCommissionValue !== null
          ? String(editingRecruit.customCommissionValue)
          : ''
      );
      setPreferredPaymentMethod(editingRecruit.preferredPaymentMethod);
      setPaymentAccountDetail(editingRecruit.paymentAccountDetail);
    } else {
      setName('');
      setRole('');
      setCompany('');
      setEmail('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setCommissionModel('percentage');
      setCustomValue('');
      setPreferredPaymentMethod('ACH Direct Deposit');
      setPaymentAccountDetail('');
    }
    setError('');
  }, [open, editingRecruit]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Employee name is required.');
      return;
    }
    if (!role.trim() || !company.trim()) {
      setError('Role and hiring company are required.');
      return;
    }
    if (!paymentAccountDetail.trim()) {
      setError('Payment account or destination detail is required.');
      return;
    }

    const normalizedEmail =
      email.trim() ||
      `${name.trim().toLowerCase().replace(/\s+/g, '.')}@company.com`;
    if (normalizedEmail.length < 3 || normalizedEmail.length > 160) {
      setError('Work email must be between 3 and 160 characters.');
      return;
    }

    let parsedCustom: number | null = null;
    if (customValue.trim() !== '') {
      const n = Number(customValue);
      if (!Number.isFinite(n) || n < 0) {
        setError('Custom commission value must be a non-negative number.');
        return;
      }
      if (commissionModel === 'percentage' && n > 100) {
        setError('Percentage commission cannot exceed 100%.');
        return;
      }
      if (commissionModel === 'flat' && n > 1000000) {
        setError('Flat commission cannot exceed Br 1,000,000.');
        return;
      }
      parsedCustom = n;
    } else if (commissionModel === 'flat') {
      setError('Enter a flat commission amount per payout.');
      return;
    }

    setError('');
    onSave(
      {
        name,
        role,
        company,
        email: normalizedEmail,
        startDate,
        commissionModel,
        customCommissionValue: parsedCustom,
        preferredPaymentMethod,
        paymentAccountDetail,
        active: true,
      },
      editingRecruit?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recruit-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="recruit-modal-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              {editingRecruit ? 'Edit Recruited Employee' : 'Add Recruited Employee'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set commission terms and default payment method
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recruit modal"
            className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-lg"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="recruit-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="recruit-name"
                type="text"
                maxLength={120}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Jordan Rivera"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="recruit-role"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Role / Title
              </label>
              <input
                id="recruit-role"
                type="text"
                maxLength={120}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Staff ML Engineer"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="recruit-company"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Placed At Company
              </label>
              <input
                id="recruit-company"
                type="text"
                maxLength={120}
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="recruit-start-date"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Start Date
              </label>
              <input
                id="recruit-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="recruit-email"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Work Email
            </label>
            <input
              id="recruit-email"
              type="email"
              maxLength={160}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              placeholder="name@company.com"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label
                htmlFor="recruit-comm-model"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Commission Model
              </label>
              <select
                id="recruit-comm-model"
                value={commissionModel}
                onChange={(e) =>
                  setCommissionModel(e.target.value as CommissionModel)
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                <option value="percentage">Percentage of Pay (%)</option>
                <option value="flat">Flat Fee per Payout (Br)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="recruit-comm-value"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                {commissionModel === 'flat'
                  ? 'Flat Commission (Br)'
                  : `Custom Rate % (blank = ${rules.defaultCommissionRatePct}%)`}
              </label>
              <input
                id="recruit-comm-value"
                type="number"
                step="0.5"
                min="0"
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value);
                  if (error) setError('');
                }}
                placeholder={
                  commissionModel === 'flat'
                    ? 'e.g. 750'
                    : `Default (${rules.defaultCommissionRatePct}%)`
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="recruit-payment-method"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Preferred Payment Method
              </label>
              <select
                id="recruit-payment-method"
                value={preferredPaymentMethod}
                onChange={(e) =>
                  setPreferredPaymentMethod(e.target.value as PaymentMethodType)
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {PAYMENT_METHOD_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="recruit-account-detail"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Account / Destination Detail
              </label>
              <input
                id="recruit-account-detail"
                type="text"
                maxLength={160}
                value={paymentAccountDetail}
                onChange={(e) => {
                  setPaymentAccountDetail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Chase Checking ••8392"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              {editingRecruit ? 'Save Changes' : 'Add Recruit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
