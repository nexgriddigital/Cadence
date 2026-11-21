import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Pencil,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { Applicant, ApplicantStage } from '../types/payroll';
import { formatCurrency, formatDateShort } from '../utils/commissionEngine';
import { APPLICANT_STAGES } from './ApplicantModal';

interface ApplicantsViewProps {
  applicants: Applicant[];
  onAddApplicant: () => void;
  onEditApplicant: (applicant: Applicant) => void;
  onChangeStage: (applicantId: string, stage: ApplicantStage) => void;
  onDeleteApplicant: (applicantId: string) => void;
  onConvertToRecruit: (applicant: Applicant) => void;
}

const STAGE_FILTERS: Array<ApplicantStage | 'All'> = [
  'All',
  'New',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'Rejected',
];

const STAGE_STYLES: Record<ApplicantStage, string> = {
  New: 'text-slate-700 bg-slate-100 border-slate-200',
  Screening: 'text-blue-700 bg-blue-50 border-blue-200',
  Interview: 'text-amber-700 bg-amber-50 border-amber-200',
  Offer: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  Hired: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Rejected: 'text-red-700 bg-red-50 border-red-200',
};

export function ApplicantsView({
  applicants,
  onAddApplicant,
  onEditApplicant,
  onChangeStage,
  onDeleteApplicant,
  onConvertToRecruit,
}: ApplicantsViewProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<ApplicantStage | 'All'>('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = applicants.length;
    const active = applicants.filter(
      (a) => a.stage !== 'Hired' && a.stage !== 'Rejected'
    ).length;
    const interviewOrOffer = applicants.filter(
      (a) => a.stage === 'Interview' || a.stage === 'Offer'
    ).length;
    const hired = applicants.filter((a) => a.stage === 'Hired').length;
    return { total, active, interviewOrOffer, hired };
  }, [applicants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applicants.filter((applicant) => {
      if (stageFilter !== 'All' && applicant.stage !== stageFilter) {
        return false;
      }
      if (!q) return true;
      return [
        applicant.name,
        applicant.email,
        applicant.phone,
        applicant.targetRole,
        applicant.targetCompany,
        applicant.source,
        applicant.stage,
        applicant.notes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [applicants, search, stageFilter]);

  return (
    <div className="space-y-5">
      {/* Pipeline Summary Strip */}
      <section
        aria-label="Applicant pipeline summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Applicants</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {stats.total}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            All tracked candidates
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Active Pipeline</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
            {stats.active}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            New, screening, interview & offer
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Interview & Offer</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {stats.interviewOrOffer}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Late-stage candidates
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Hired</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {stats.hired}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Ready for recruit payroll ledger
          </p>
        </div>
      </section>

      {/* Search, Filter & Add Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role, company..."
              aria-label="Search applicants"
              className="pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 w-64"
            />
          </div>

          <div
            role="group"
            aria-label="Filter applicants by stage"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {STAGE_FILTERS.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setStageFilter(stage)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  stageFilter === stage
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onAddApplicant}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          <span>Add Applicant</span>
        </button>
      </div>

      {/* Applicants Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <p className="text-sm font-medium text-slate-900">
              {applicants.length === 0
                ? 'No applicants tracked yet'
                : 'No applicants match your current filter'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {applicants.length === 0
                ? 'Add candidates to track their screening stage and promote hired applicants directly into your Recruits roster.'
                : 'Try adjusting your search query or stage filter.'}
            </p>
            <div className="mt-4">
              {applicants.length === 0 ? (
                <button
                  type="button"
                  onClick={onAddApplicant}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  Add First Applicant
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStageFilter('All');
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 whitespace-nowrap">
                  <th className="py-3 px-5">Candidate</th>
                  <th className="py-3 px-4">Target Role & Company</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Expected Pay</th>
                  <th className="py-3 px-4">Applied</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((applicant) => {
                  const isConverted = Boolean(applicant.convertedRecruitId);
                  const isDeleting = confirmDeleteId === applicant.id;

                  return (
                    <tr
                      key={applicant.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5 max-w-[220px]">
                        <div className="font-medium text-slate-900 truncate">
                          {applicant.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {applicant.email}
                          {applicant.phone ? ` · ${applicant.phone}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="text-xs font-medium text-slate-800 truncate">
                          {applicant.targetRole}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {applicant.targetCompany || 'Open placement'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {applicant.source || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                        {applicant.expectedSalary > 0
                          ? formatCurrency(applicant.expectedSalary)
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateShort(applicant.appliedDate)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          aria-label={`Stage for ${applicant.name}`}
                          value={applicant.stage}
                          onChange={(e) =>
                            onChangeStage(
                              applicant.id,
                              e.target.value as ApplicantStage
                            )
                          }
                          className={`px-2.5 py-1 text-xs font-medium border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${STAGE_STYLES[applicant.stage]}`}
                        >
                          {APPLICANT_STAGES.map((stage) => (
                            <option
                              key={stage}
                              value={stage}
                              className="bg-white text-slate-900"
                            >
                              {stage}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {isDeleting ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteApplicant(applicant.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            {isConverted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md">
                                <CheckCircle2
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>Recruited</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onConvertToRecruit(applicant)}
                                aria-label={`Promote ${applicant.name} to Recruits`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                              >
                                <UserCheck
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>Hire</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditApplicant(applicant)}
                              aria-label={`Edit ${applicant.name}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(applicant.id)}
                              aria-label={`Delete ${applicant.name}`}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
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
