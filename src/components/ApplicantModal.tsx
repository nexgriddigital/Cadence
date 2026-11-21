import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Applicant, ApplicantStage } from '../types/payroll';
import type { ApplicantInput } from '../hooks/usePayrollStore';

export const APPLICANT_STAGES: ApplicantStage[] = [
  'New',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'Rejected',
];

const SOURCE_SUGGESTIONS = [
  'LinkedIn',
  'Referral',
  'Job Board',
  'Direct Application',
  'Agency Outreach',
];

interface ApplicantModalProps {
  open: boolean;
  editingApplicant: Applicant | null;
  onClose: () => void;
  onSave: (input: ApplicantInput, existingId?: string) => void;
}

export function ApplicantModal({
  open,
  editingApplicant,
  onClose,
  onSave,
}: ApplicantModalProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [source, setSource] = useState('LinkedIn');
  const [appliedDate, setAppliedDate] = useState(todayIso);
  const [expectedSalary, setExpectedSalary] = useState('');
  const [stage, setStage] = useState<ApplicantStage>('New');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editingApplicant) {
      setName(editingApplicant.name);
      setEmail(editingApplicant.email);
      setPhone(editingApplicant.phone);
      setTargetRole(editingApplicant.targetRole);
      setTargetCompany(editingApplicant.targetCompany);
      setSource(editingApplicant.source);
      setAppliedDate(editingApplicant.appliedDate);
      setExpectedSalary(
        editingApplicant.expectedSalary > 0
          ? String(editingApplicant.expectedSalary)
          : ''
      );
      setStage(editingApplicant.stage);
      setNotes(editingApplicant.notes);
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setTargetRole('');
      setTargetCompany('');
      setSource('LinkedIn');
      setAppliedDate(new Date().toISOString().slice(0, 10));
      setExpectedSalary('');
      setStage('New');
      setNotes('');
    }
    setError('');
  }, [open, editingApplicant]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Applicant name is required.');
      return;
    }
    if (!targetRole.trim()) {
      setError('Target role is required.');
      return;
    }

    const normalizedEmail =
      email.trim() ||
      `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')}@applicant.local`;
    if (normalizedEmail.length < 3 || normalizedEmail.length > 160) {
      setError('Email address must be between 3 and 160 characters.');
      return;
    }

    let parsedSalary = 0;
    if (expectedSalary.trim() !== '') {
      const n = Number(expectedSalary);
      if (!Number.isFinite(n) || n < 0 || n > 10000000) {
        setError('Expected pay must be between Br 0 and Br 10,000,000.');
        return;
      }
      parsedSalary = Math.round(n * 100) / 100;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appliedDate)) {
      setError('Please select a valid application date.');
      return;
    }

    setError('');
    onSave(
      {
        name,
        email: normalizedEmail,
        phone,
        targetRole,
        targetCompany,
        source,
        appliedDate,
        expectedSalary: parsedSalary,
        stage,
        notes,
        convertedRecruitId: editingApplicant?.convertedRecruitId ?? null,
      },
      editingApplicant?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="applicant-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="applicant-modal-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              {editingApplicant ? 'Edit Applicant' : 'Add Applicant'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track candidate details, pipeline stage, and target placement
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close applicant modal"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="applicant-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="applicant-name"
                type="text"
                maxLength={120}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Selamawit Bekele"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="applicant-role"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Target Role
              </label>
              <input
                id="applicant-role"
                type="text"
                maxLength={120}
                value={targetRole}
                onChange={(e) => {
                  setTargetRole(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="applicant-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="applicant-email"
                type="email"
                maxLength={160}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="candidate@email.com"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="applicant-phone"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Phone Number
              </label>
              <input
                id="applicant-phone"
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9XX XXX XXX"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="applicant-company"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Target Company
              </label>
              <input
                id="applicant-company"
                type="text"
                maxLength={120}
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                placeholder="e.g. EthioTech Systems"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="applicant-source"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Source
              </label>
              <input
                id="applicant-source"
                type="text"
                list="applicant-source-options"
                maxLength={80}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. LinkedIn, Referral"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <datalist id="applicant-source-options">
                {SOURCE_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label
                htmlFor="applicant-stage"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Stage
              </label>
              <select
                id="applicant-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as ApplicantStage)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {APPLICANT_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="applicant-salary"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Expected Pay (Br)
              </label>
              <input
                id="applicant-salary"
                type="number"
                min="0"
                step="100"
                value={expectedSalary}
                onChange={(e) => {
                  setExpectedSalary(e.target.value);
                  if (error) setError('');
                }}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="applicant-date"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Applied Date
              </label>
              <input
                id="applicant-date"
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="applicant-notes"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Screening & Interview Notes
            </label>
            <textarea
              id="applicant-notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key skills, interview feedback, availability, or follow-up steps..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none"
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              {editingApplicant ? 'Save Changes' : 'Add Applicant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
