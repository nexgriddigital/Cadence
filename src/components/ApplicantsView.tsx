import { Fragment, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Pencil,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type {
  Applicant,
  ApplicantStage,
  ApplicantTestAssignment,
  ExamFormRecord,
} from '../types/payroll';
import { formatCurrency, formatDateShort } from '../utils/commissionEngine';
import { EXAM_TEST_TYPES, getExamTestSpec } from '../utils/examBlueprint';
import { APPLICANT_STAGES } from './ApplicantModal';

interface ApplicantsViewProps {
  applicants: Applicant[];
  applicantTests: ApplicantTestAssignment[];
  examForms: ExamFormRecord[];
  onAddApplicant: () => void;
  onEditApplicant: (applicant: Applicant) => void;
  onChangeStage: (applicantId: string, stage: ApplicantStage) => void;
  onDeleteApplicant: (applicantId: string) => void;
  onConvertToRecruit: (applicant: Applicant) => void;
  onAssignMissingTests: (applicant: Applicant) => void;
  onOpenGoogleForms: () => void;
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
  applicantTests,
  examForms,
  onAddApplicant,
  onEditApplicant,
  onChangeStage,
  onDeleteApplicant,
  onConvertToRecruit,
  onAssignMissingTests,
  onOpenGoogleForms,
}: ApplicantsViewProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<ApplicantStage | 'All'>('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedApplicantId, setExpandedApplicantId] = useState<string | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const formsByType = useMemo(
    () => new Map(examForms.map((f) => [f.testType, f])),
    [examForms]
  );

  const testsByApplicantId = useMemo(() => {
    const map = new Map<string, ApplicantTestAssignment[]>();
    for (const t of applicantTests) {
      const list = map.get(t.applicantId) ?? [];
      list.push(t);
      map.set(t.applicantId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          EXAM_TEST_TYPES.indexOf(a.testType) -
          EXAM_TEST_TYPES.indexOf(b.testType)
      );
    }
    return map;
  }, [applicantTests]);

  const stats = useMemo(() => {
    const total = applicants.length;
    const active = applicants.filter(
      (a) => a.stage !== 'Hired' && a.stage !== 'Rejected'
    ).length;
    const assignedTestsCount = applicantTests.length;
    const passedTestsCount = applicantTests.filter(
      (t) => t.status === 'Passed'
    ).length;
    const hired = applicants.filter((a) => a.stage === 'Hired').length;
    return {
      total,
      active,
      assignedTestsCount,
      passedTestsCount,
      hired,
    };
  }, [applicants, applicantTests]);

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

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      // Clipboard blocked in restricted context; ignore silently
    }
  };

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
            New, screening, interview &amp; offer
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Auto-Assigned Tests
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {stats.assignedTestsCount}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {stats.passedTestsCount} passed · {examForms.length}/4 Google Forms
            connected
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
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {applicants.length === 0
                ? 'When you add an applicant, Cadence automatically assigns all 4 Google Forms screening tests and tracks their results.'
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
                  <th className="py-3 px-4">Target Role &amp; Company</th>
                  <th className="py-3 px-4">Assigned Google Tests</th>
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
                  const isExpanded = expandedApplicantId === applicant.id;
                  const assignedTests =
                    testsByApplicantId.get(applicant.id) ?? [];
                  const passedCount = assignedTests.filter(
                    (t) => t.status === 'Passed'
                  ).length;
                  const failedCount = assignedTests.filter(
                    (t) => t.status === 'Failed'
                  ).length;
                  const hasMissingTests =
                    assignedTests.length < EXAM_TEST_TYPES.length;

                  const connectedLinksPacket = assignedTests
                    .map((t) => {
                      const spec = getExamTestSpec(t.testType);
                      const liveUri =
                        t.responderUri ||
                        formsByType.get(t.testType)?.responderUri ||
                        '';
                      return liveUri ? `${spec.label}: ${liveUri}` : null;
                    })
                    .filter((line): line is string => Boolean(line));

                  return (
                    <Fragment key={applicant.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 max-w-[220px]">
                          <div className="font-medium text-slate-900 truncate">
                            {applicant.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {applicant.email}
                            {applicant.phone ? ` · ${applicant.phone}` : ''}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-[210px]">
                          <div className="text-xs font-medium text-slate-800 truncate">
                            {applicant.targetRole}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {applicant.targetCompany || 'Open placement'}
                            {applicant.source ? ` · ${applicant.source}` : ''}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {assignedTests.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedApplicantId(
                                    isExpanded ? null : applicant.id
                                  )
                                }
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                              >
                                <ClipboardCheck
                                  className="w-3.5 h-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="font-mono tabular-nums">
                                  {passedCount}/{assignedTests.length} Passed
                                </span>
                                {failedCount > 0 && (
                                  <span className="text-red-600 font-mono tabular-nums">
                                    ({failedCount} Failed)
                                  </span>
                                )}
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">
                                0/4 Assigned
                              </span>
                            )}

                            {hasMissingTests && (
                              <button
                                type="button"
                                onClick={() => onAssignMissingTests(applicant)}
                                className="px-2 py-0.5 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                              >
                                Assign {EXAM_TEST_TYPES.length - assignedTests.length}
                              </button>
                            )}
                          </div>
                          {assignedTests.length > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {assignedTests.length} of 4 screening tests
                              assigned
                            </div>
                          )}
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
                                <Pencil
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(applicant.id)}
                                aria-label={`Delete ${applicant.name}`}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              >
                                <Trash2
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-xs font-semibold text-slate-900">
                                    Assigned Google Forms Screening Suite for{' '}
                                    {applicant.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Each test enforces Duolingo 100+ and 3
                                    anti-AI trick questions. Results sync
                                    automatically by email ({applicant.email}).
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {connectedLinksPacket.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleCopy(
                                          `Cadence Screening Tests for ${applicant.name}:\n${connectedLinksPacket.join('\n')}`,
                                          `packet-${applicant.id}`
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                      {copiedKey === `packet-${applicant.id}` ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                                          <span className="text-emerald-700">
                                            Copied {connectedLinksPacket.length}{' '}
                                            Links
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>
                                            Copy All Connected Links (
                                            {connectedLinksPacket.length})
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={onOpenGoogleForms}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                                  >
                                    Manage Google Forms
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {EXAM_TEST_TYPES.map((testType) => {
                                  const spec = getExamTestSpec(testType);
                                  const assignment = assignedTests.find(
                                    (t) => t.testType === testType
                                  );
                                  const liveForm = formsByType.get(testType);
                                  const responderUri =
                                    assignment?.responderUri ||
                                    liveForm?.responderUri ||
                                    '';
                                  const status =
                                    assignment?.status ?? 'Assigned';

                                  return (
                                    <div
                                      key={testType}
                                      className="p-3.5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-2.5"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="text-xs font-semibold text-slate-900">
                                            {spec.label}
                                          </div>
                                          <div className="text-[11px] text-slate-500 mt-0.5">
                                            {assignment?.formTitle &&
                                            assignment.formTitle !== spec.label
                                              ? assignment.formTitle
                                              : spec.summary}
                                          </div>
                                        </div>

                                        <span
                                          className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                                            status === 'Passed'
                                              ? 'text-emerald-700'
                                              : status === 'Failed'
                                                ? 'text-red-700'
                                                : 'text-blue-700'
                                          }`}
                                        >
                                          {status === 'Passed' && (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          )}
                                          {status === 'Failed' && (
                                            <XCircle className="w-3.5 h-3.5" />
                                          )}
                                          <span>
                                            {assignment ? status : 'Not Assigned'}
                                          </span>
                                        </span>
                                      </div>

                                      {assignment &&
                                        assignment.status !== 'Assigned' && (
                                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-slate-600 pt-1 border-t border-slate-100">
                                            <span>
                                              Duolingo:{' '}
                                              {assignment.duolingoScore}/160
                                            </span>
                                            <span>
                                              AI Risk:{' '}
                                              {assignment.aiLikelihoodPct}%
                                            </span>
                                            <span>
                                              Quality: {assignment.qualityScore}
                                              /100
                                            </span>
                                          </div>
                                        )}

                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                                        {responderUri ? (
                                          <>
                                            <a
                                              href={responderUri}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                                            >
                                              <span>Open Form</span>
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void handleCopy(
                                                  responderUri,
                                                  `${applicant.id}-${testType}`
                                                )
                                              }
                                              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                                            >
                                              {copiedKey ===
                                              `${applicant.id}-${testType}` ? (
                                                <>
                                                  <Check className="w-3 h-3 text-emerald-700" />
                                                  <span className="text-emerald-700">
                                                    Copied
                                                  </span>
                                                </>
                                              ) : (
                                                <>
                                                  <Copy className="w-3 h-3" />
                                                  <span>Copy Link</span>
                                                </>
                                              )}
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={onOpenGoogleForms}
                                            className="text-[11px] font-medium text-amber-700 hover:text-amber-900"
                                          >
                                            Form not connected yet — Connect in
                                            Google Forms →
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
