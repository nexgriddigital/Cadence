import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FilePlus2,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseContext';
import type {
  Applicant,
  ApplicantInvite,
  ExamFormRecord,
  ExamSubmissionRecord,
} from '../types/payroll';
import type {
  ApplicantInput,
  SaveExamFormInput,
  SaveExamSubmissionInput,
} from '../hooks/usePayrollStore';
import {
  MIN_DUOLINGO_SCORE,
  SCREENING_EXAM_QUESTIONS,
} from '../utils/examBlueprint';
import {
  analyzeExamSubmission,
  createScreeningExamForm,
  extractFormIdFromInput,
  fetchFormMetadata,
  fetchFormResponses,
  parseGoogleFormResponses,
} from '../utils/googleFormsApi';

interface GoogleFormsViewProps {
  examForms: ExamFormRecord[];
  examSubmissions: ExamSubmissionRecord[];
  applicantInvites: ApplicantInvite[];
  applicants: Applicant[];
  onSaveExamForm: (input: SaveExamFormInput) => Promise<ExamFormRecord | null>;
  onDeleteExamForm: (formDocId: string) => Promise<void>;
  onSaveExamSubmission: (
    input: SaveExamSubmissionInput
  ) => Promise<ExamSubmissionRecord | null>;
  onDeleteExamSubmission: (submissionId: string) => Promise<void>;
  onIssueInvite: (submission: ExamSubmissionRecord) => Promise<string | null>;
  onRevokeInvite: (code: string) => Promise<void>;
  onAddApplicant: (input: ApplicantInput) => Promise<Applicant | null>;
}

function OfficialGoogleLogo() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function GoogleFormsView({
  examForms,
  examSubmissions,
  applicantInvites,
  applicants,
  onSaveExamForm,
  onDeleteExamForm,
  onSaveExamSubmission,
  onDeleteExamSubmission,
  onIssueInvite,
  onRevokeInvite,
  onAddApplicant,
}: GoogleFormsViewProps) {
  const {
    formsAccessToken,
    connectingForms,
    formsAuthError,
    connectGoogleForms,
  } = useFirebaseAuth();

  // Form creation confirmation dialog state
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState(
    'Cadence Applicant Screening Exam (Duolingo 100+)'
  );
  const [creatingForm, setCreatingForm] = useState(false);

  // Link existing form state
  const [linkInput, setLinkInput] = useState('');
  const [linkingForm, setLinkingForm] = useState(false);

  // Sync responses state
  const [syncingFormId, setSyncingFormId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UI toggles
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<
    string | null
  >(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [issuingForId, setIssuingForId] = useState<string | null>(null);
  const [confirmRevokeCode, setConfirmRevokeCode] = useState<string | null>(
    null
  );

  // Manual analyzer form state
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualRole, setManualRole] = useState('');
  const [manualDuolingo, setManualDuolingo] = useState('115');
  const [manualProof, setManualProof] = useState('');
  const [manualScenario, setManualScenario] = useState('');
  const [manualConstraint, setManualConstraint] = useState('');
  const [manualLogic, setManualLogic] = useState('');
  const [manualCanary, setManualCanary] = useState('');
  const [analyzingManual, setAnalyzingManual] = useState(false);

  const applicantEmails = useMemo(
    () => new Set(applicants.map((a) => a.email.trim().toLowerCase())),
    [applicants]
  );

  const stats = useMemo(() => {
    const total = examSubmissions.length;
    const passed = examSubmissions.filter((s) => s.passed).length;
    const aiFlagged = examSubmissions.filter(
      (s) => s.aiSuspected || s.canaryTriggered
    ).length;
    const activeCodes = applicantInvites.filter(
      (i) => i.status === 'Active'
    ).length;
    return { total, passed, aiFlagged, activeCodes };
  }, [examSubmissions, applicantInvites]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);
      setTimeout(() => {
        setCopiedValue((prev) => (prev === text ? null : prev));
      }, 2000);
    } catch {
      setErrorMessage('Unable to copy to clipboard. Copy the text manually.');
    }
  };

  const ensureFormsToken = async (): Promise<string | null> => {
    if (formsAccessToken) return formsAccessToken;
    return connectGoogleForms();
  };

  const handleConfirmedCreateForm = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const token = await ensureFormsToken();
    if (!token) return;

    setCreatingForm(true);
    try {
      const created = await createScreeningExamForm(token, newFormTitle);
      await onSaveExamForm({
        googleFormId: created.googleFormId,
        title: created.title,
        responderUri: created.responderUri,
        editUrl: created.editUrl,
        ...created.questionMap,
      });
      setConfirmCreateOpen(false);
      setStatusMessage(
        `Created Google Form "${created.title}" with Duolingo 100+ verification and 3 anti-AI trick questions.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to create Google Form.'
      );
    } finally {
      setCreatingForm(false);
    }
  };

  const handleLinkExistingForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    let extractedId = '';
    try {
      extractedId = extractFormIdFromInput(linkInput);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid Form ID.');
      return;
    }

    const token = await ensureFormsToken();
    if (!token) return;

    setLinkingForm(true);
    try {
      const metadata = await fetchFormMetadata(token, extractedId);
      await onSaveExamForm({
        googleFormId: metadata.googleFormId,
        title: metadata.title,
        responderUri: metadata.responderUri,
        editUrl: metadata.editUrl,
        ...metadata.questionMap,
      });
      setLinkInput('');
      setStatusMessage(`Linked Google Form "${metadata.title}".`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to link Google Form.'
      );
    } finally {
      setLinkingForm(false);
    }
  };

  const handleSyncFormResponses = async (form: ExamFormRecord) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const token = await ensureFormsToken();
    if (!token) return;

    setSyncingFormId(form.id);
    try {
      const rawResponses = await fetchFormResponses(token, form.googleFormId);
      const parsedResponses = parseGoogleFormResponses(form, rawResponses);

      const existingResponseIds = new Set(
        examSubmissions
          .filter((s) => s.googleFormId === form.googleFormId)
          .map((s) => s.responseId)
      );

      const newResponses = parsedResponses.filter(
        (r) => !existingResponseIds.has(r.responseId)
      );

      if (newResponses.length === 0) {
        setStatusMessage(
          `Synced "${form.title}": ${parsedResponses.length} total response(s), 0 new submissions to analyze.`
        );
        return;
      }

      let analyzedCount = 0;
      let passedCount = 0;
      for (const candidate of newResponses) {
        const analysis = await analyzeExamSubmission({
          applicantName: candidate.applicantName,
          applicantEmail: candidate.applicantEmail || 'unknown@applicant.local',
          targetRole: candidate.targetRole,
          duolingoScoreRaw: candidate.duolingoScoreRaw,
          duolingoProof: candidate.duolingoProof,
          scenarioResponse: candidate.scenarioResponse,
          trickConstraint: candidate.trickConstraint,
          trickLogic: candidate.trickLogic,
          trickCanary: candidate.trickCanary,
        });

        await onSaveExamSubmission({
          googleFormId: form.googleFormId,
          responseId: candidate.responseId,
          applicantName: candidate.applicantName,
          applicantEmail: candidate.applicantEmail || 'unknown@applicant.local',
          targetRole: candidate.targetRole,
          duolingoScore: analysis.duolingoScore,
          duolingoProof: candidate.duolingoProof,
          duolingoPassed: analysis.duolingoPassed,
          canaryTriggered: analysis.canaryTriggered,
          trickQuestionsPassed: analysis.trickQuestionsPassed,
          aiLikelihoodPct: analysis.aiLikelihoodPct,
          aiSuspected: analysis.aiSuspected,
          qualityScore: analysis.qualityScore,
          passed: analysis.passed,
          flags: analysis.flags,
          summary: analysis.summary,
          submittedAt: candidate.submittedAt,
        });
        analyzedCount += 1;
        if (analysis.passed) passedCount += 1;
      }

      setStatusMessage(
        `Analyzed ${analyzedCount} new submission(s) from "${form.title}" — ${passedCount} passed verification.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to sync and analyze Google Form responses.'
      );
    } finally {
      setSyncingFormId(null);
    }
  };

  const handleManualAnalyze = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!manualName.trim() || !manualEmail.trim()) {
      setErrorMessage('Enter the applicant name and email address.');
      return;
    }

    setAnalyzingManual(true);
    try {
      const analysis = await analyzeExamSubmission({
        applicantName: manualName.trim(),
        applicantEmail: manualEmail.trim().toLowerCase(),
        targetRole: manualRole.trim(),
        duolingoScoreRaw: manualDuolingo.trim(),
        duolingoProof: manualProof.trim(),
        scenarioResponse: manualScenario.trim(),
        trickConstraint: manualConstraint.trim(),
        trickLogic: manualLogic.trim(),
        trickCanary: manualCanary.trim(),
      });

      const saved = await onSaveExamSubmission({
        googleFormId: examForms[0]?.googleFormId ?? 'manual-screening',
        responseId: `manual-${Date.now()}`,
        applicantName: manualName.trim(),
        applicantEmail: manualEmail.trim().toLowerCase(),
        targetRole: manualRole.trim(),
        duolingoScore: analysis.duolingoScore,
        duolingoProof: manualProof.trim(),
        duolingoPassed: analysis.duolingoPassed,
        canaryTriggered: analysis.canaryTriggered,
        trickQuestionsPassed: analysis.trickQuestionsPassed,
        aiLikelihoodPct: analysis.aiLikelihoodPct,
        aiSuspected: analysis.aiSuspected,
        qualityScore: analysis.qualityScore,
        passed: analysis.passed,
        flags: analysis.flags,
        summary: analysis.summary,
        submittedAt: new Date().toISOString(),
      });

      if (saved) {
        setExpandedSubmissionId(saved.id);
      }
      setStatusMessage(
        analysis.passed
          ? `${manualName.trim()} passed the screening exam (Duolingo ${analysis.duolingoScore}, AI Risk ${analysis.aiLikelihoodPct}%). You can now generate their registration code.`
          : `${manualName.trim()} did not pass screening (${analysis.flags[0] || 'failed authenticity or score checks'}).`
      );
      setManualName('');
      setManualEmail('');
      setManualRole('');
      setManualProof('');
      setManualScenario('');
      setManualConstraint('');
      setManualLogic('');
      setManualCanary('');
      setManualOpen(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Exam analysis failed.'
      );
    } finally {
      setAnalyzingManual(false);
    }
  };

  const handleGenerateInvite = async (submission: ExamSubmissionRecord) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIssuingForId(submission.id);
    try {
      const code = await onIssueInvite(submission);
      if (code) {
        setStatusMessage(
          `Issued registration code ${code} for ${submission.applicantName} (${submission.applicantEmail}). Share this code so they can create their Cadence account.`
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to issue registration code.'
      );
    } finally {
      setIssuingForId(null);
    }
  };

  const handleAddToPipeline = async (submission: ExamSubmissionRecord) => {
    try {
      await onAddApplicant({
        name: submission.applicantName,
        email: submission.applicantEmail,
        phone: '',
        targetRole: submission.targetRole || 'Candidate',
        targetCompany: '',
        source: 'Google Forms Screening Exam',
        appliedDate: new Date().toISOString().slice(0, 10),
        expectedSalary: 0,
        stage: submission.passed ? 'Interview' : 'Rejected',
        notes: `Duolingo: ${submission.duolingoScore}/160 · Exam Score: ${submission.qualityScore}/100 · AI Risk: ${submission.aiLikelihoodPct}%${
          submission.inviteCode ? ` · Code: ${submission.inviteCode}` : ''
        }`,
      });
      setStatusMessage(
        `Added ${submission.applicantName} to the Applicants pipeline.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to add applicant.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Analyzed Submissions
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Duolingo {MIN_DUOLINGO_SCORE}+ &amp; AI-checked
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Verified Passing
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-700">
            {stats.passed}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Eligible for Cadence registration
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            AI / Trap Flagged
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-red-700">
            {stats.aiFlagged}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Canary or synthetic writing detected
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Active Registration Codes
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums text-blue-700">
            {stats.activeCodes}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {applicantInvites.filter((i) => i.status === 'Used').length} redeemed
            on Cadence
          </div>
        </div>
      </div>

      {/* Feedback alerts */}
      {(errorMessage || formsAuthError) && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 p-3.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage || formsAuthError}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            className="text-red-500 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 p-3.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            aria-label="Dismiss notice"
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Forms Administration Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Google Forms Screening Exam
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Generate a Google Form enforcing a minimum{' '}
              <span className="font-semibold text-slate-900">
                Duolingo English Test score of {MIN_DUOLINGO_SCORE}
              </span>{' '}
              with 3 built-in anti-AI trick questions, then sync and verify
              human authorship before issuing a Cadence account registration
              code.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!formsAccessToken ? (
              <button
                type="button"
                onClick={() => void connectGoogleForms()}
                disabled={connectingForms}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 border border-slate-300 rounded-lg text-sm font-medium shadow-2xs transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <OfficialGoogleLogo />
                <span>
                  {connectingForms
                    ? 'Connecting Google...'
                    : 'Sign in with Google Forms'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCreateOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Create Screening Exam Form</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <Sparkles className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
              <span>{manualOpen ? 'Close Manual Test' : 'Analyze Response Manually'}</span>
            </button>
          </div>
        </div>

        {/* Link existing Google Form row */}
        <form
          onSubmit={(e) => void handleLinkExistingForm(e)}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Link2
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Link an existing Google Form edit URL (https://docs.google.com/forms/d/FORM_ID/edit) or Form ID"
              aria-label="Existing Google Form URL or ID"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={linkingForm || !linkInput.trim()}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            {linkingForm ? 'Linking...' : 'Link Existing Form'}
          </button>
        </form>

        {/* Active linked forms */}
        {examForms.length === 0 ? (
          <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
            <p className="text-sm font-medium text-slate-800">
              No Google Form connected yet
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Connect Google Forms above to auto-generate the Cadence Screening
              Exam (Duolingo 100+ + 3 anti-AI trick questions), or use{' '}
              <span className="font-medium text-slate-700">
                Analyze Response Manually
              </span>{' '}
              to evaluate answers directly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {examForms.map((form) => (
              <div
                key={form.id}
                className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {form.title}
                    </h3>
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    Form ID: {form.googleFormId}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <a
                      href={form.responderUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
                    >
                      <span>Open Applicant Form</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopy(form.responderUri)}
                      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                    >
                      {copiedValue === form.responderUri ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="text-emerald-700">Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Applicant Link</span>
                        </>
                      )}
                    </button>
                    <a
                      href={form.editUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                    >
                      <span>Edit in Google Forms</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleSyncFormResponses(form)}
                    disabled={syncingFormId === form.id}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        syncingFormId === form.id ? 'animate-spin' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {syncingFormId === form.id
                        ? 'Syncing & Analyzing...'
                        : 'Sync & Analyze Responses'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteExamForm(form.id)}
                    aria-label={`Remove ${form.title}`}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expandable Exam Blueprint & Anti-AI Trap Specification */}
        <div className="border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setBlueprintOpen((v) => !v)}
            className="flex items-center justify-between w-full text-left text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            <span>
              Inspect Screening Exam Blueprint ({SCREENING_EXAM_QUESTIONS.length}{' '}
              questions · Duolingo {MIN_DUOLINGO_SCORE}+ &amp; 3 Anti-AI Trick
              Questions)
            </span>
            {blueprintOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {blueprintOpen && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {SCREENING_EXAM_QUESTIONS.map((q, index) => (
                <div
                  key={q.key}
                  className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                    q.isTrickQuestion
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {index + 1}. {q.title}
                    </span>
                    {q.isTrickQuestion && (
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        Anti-AI Trap ({q.trickType})
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {q.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Manual Response Analyzer Panel */}
      {manualOpen && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Direct Exam Response Analyzer
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste or test an applicant&apos;s answers through the exact same
                Duolingo 100+ gate, trick-question checker, and Gemini AI
                forensic detector.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              aria-label="Close analyzer"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={(e) => void handleManualAnalyze(e)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Selamawit Bekele"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="selam@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Role
                </label>
                <input
                  type="text"
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                  placeholder="Operations Coordinator"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Duolingo Score (min {MIN_DUOLINGO_SCORE}) *
                </label>
                <input
                  type="number"
                  min={10}
                  max={160}
                  required
                  value={manualDuolingo}
                  onChange={(e) => setManualDuolingo(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Duolingo Certificate Link / ID
              </label>
              <input
                type="text"
                value={manualProof}
                onChange={(e) => setManualProof(e.target.value)}
                placeholder="https://certs.duolingo.com/..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  1. Practical Scenario (Missed Deadline)
                </label>
                <textarea
                  rows={3}
                  required
                  value={manualScenario}
                  onChange={(e) => setManualScenario(e.target.value)}
                  placeholder="Candidate's response on handling a slipping deadline..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  2. Precision Trick Check (2 sentences, no cliché words, end with city)
                </label>
                <textarea
                  rows={3}
                  required
                  value={manualConstraint}
                  onChange={(e) => setManualConstraint(e.target.value)}
                  placeholder="Candidate's two-sentence bottleneck answer..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  3. Scheduling Logic Trap (2 before Meron; Meron is last)
                </label>
                <input
                  type="text"
                  required
                  value={manualLogic}
                  onChange={(e) => setManualLogic(e.target.value)}
                  placeholder="e.g., 2 interviews happen before Meron, and Meron is last."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  4. Written Communication + Canary Trap
                </label>
                <textarea
                  rows={2}
                  required
                  value={manualCanary}
                  onChange={(e) => setManualCanary(e.target.value)}
                  placeholder="Candidate's written follow-ups answer..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={analyzingManual}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {analyzingManual
                    ? 'Running AI & Trap Analysis...'
                    : 'Run Authenticity & Score Analysis'}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Analyzed Submissions Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Analyzed Exam Submissions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Passing requires Duolingo {MIN_DUOLINGO_SCORE}+, passing all 3
              anti-AI trick questions, AI likelihood below 55%, and quality
              score 60+.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {examSubmissions.length} total
          </span>
        </div>

        {examSubmissions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No exam submissions analyzed yet. Sync responses from your Google
            Form or run a manual check above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Duolingo</th>
                  <th className="py-3 px-4">Trick Checks</th>
                  <th className="py-3 px-4">AI Risk</th>
                  <th className="py-3 px-4">Verdict</th>
                  <th className="py-3 px-4 text-right">Registration Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {examSubmissions.map((sub) => {
                  const isExpanded = expandedSubmissionId === sub.id;
                  const alreadyInApplicants = applicantEmails.has(
                    sub.applicantEmail.trim().toLowerCase()
                  );
                  return (
                    <tr key={sub.id} className="align-top hover:bg-slate-50/60">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {sub.applicantName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {sub.applicantEmail}
                        </div>
                        {sub.targetRole && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {sub.targetRole}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSubmissionId(isExpanded ? null : sub.id)
                          }
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                        >
                          <span>
                            {isExpanded ? 'Hide analysis' : 'View AI & trap report'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 max-w-md">
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {sub.summary}
                            </p>
                            {sub.duolingoProof && (
                              <div className="text-xs text-slate-500 break-all">
                                <span className="font-medium text-slate-700">
                                  Duolingo Proof:{' '}
                                </span>
                                {sub.duolingoProof}
                              </div>
                            )}
                            <div className="text-xs text-slate-500">
                              <span className="font-medium text-slate-700">
                                Answer Quality Score:{' '}
                              </span>
                              <span className="font-mono tabular-nums">
                                {sub.qualityScore}/100
                              </span>
                            </div>
                            {sub.flags.length > 0 && (
                              <ul className="space-y-1 pt-1 border-t border-slate-200">
                                {sub.flags.map((flag, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-red-700 flex items-start gap-1.5"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>{flag}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            sub.duolingoPassed
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {sub.duolingoScore} / 160
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {sub.duolingoPassed
                            ? `Meets ${MIN_DUOLINGO_SCORE}+`
                            : `Below ${MIN_DUOLINGO_SCORE}`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sub.canaryTriggered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Canary Caught</span>
                          </span>
                        ) : sub.trickQuestionsPassed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>All Passed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Failed Trap</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            sub.aiSuspected
                              ? 'text-red-700'
                              : sub.aiLikelihoodPct >= 35
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {sub.aiLikelihoodPct}%
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {sub.aiSuspected ? 'AI Suspected' : 'Human Verified'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sub.passed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Passed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                            <XCircle className="w-4 h-4" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {sub.inviteCode ? (
                            <button
                              type="button"
                              onClick={() => void handleCopy(sub.inviteCode!)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono text-xs font-semibold rounded-lg transition-colors"
                              title="Copy registration code"
                            >
                              <span>{sub.inviteCode}</span>
                              {copiedValue === sub.inviteCode ? (
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </button>
                          ) : sub.passed ? (
                            <button
                              type="button"
                              disabled={issuingForId === sub.id}
                              onClick={() => void handleGenerateInvite(sub)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>
                                {issuingForId === sub.id
                                  ? 'Generating...'
                                  : 'Generate Code'}
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Not eligible
                            </span>
                          )}

                          {!alreadyInApplicants && (
                            <button
                              type="button"
                              onClick={() => void handleAddToPipeline(sub)}
                              title="Add to Applicants pipeline"
                              className="p-1.5 text-slate-500 hover:text-blue-700 rounded-lg transition-colors"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void onDeleteExamSubmission(sub.id)}
                            aria-label={`Delete submission for ${sub.applicantName}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </section>

      {/* Issued Registration Codes Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Applicant Account Registration Codes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Each single-use code is bound to the passing applicant&apos;s
              exact email address and required to create a Cadence applicant
              account.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {applicantInvites.length} issued
          </span>
        </div>

        {applicantInvites.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No registration codes issued yet. Generate a code for any passing
            applicant above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Registration Code</th>
                  <th className="py-3 px-4">Approved Applicant</th>
                  <th className="py-3 px-4">Duolingo</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {applicantInvites.map((invite) => (
                  <tr key={invite.code} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {invite.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {invite.applicantName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {invite.applicantEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      {invite.duolingoScore} / 160
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold ${
                          invite.status === 'Active'
                            ? 'text-blue-700'
                            : invite.status === 'Used'
                              ? 'text-emerald-700'
                              : 'text-slate-400'
                        }`}
                      >
                        {invite.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopy(invite.code)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                          {copiedValue === invite.code ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {invite.status === 'Active' &&
                          (confirmRevokeCode === invite.code ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  void onRevokeInvite(invite.code);
                                  setConfirmRevokeCode(null);
                                }}
                                className="px-2 py-1 font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                              >
                                Confirm Revoke
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeCode(null)}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeCode(invite.code)}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            >
                              Revoke
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Explicit Confirmation Modal before creating a Google Form via Workspace API */}
      {confirmCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-create-form-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="confirm-create-form-title"
                  className="font-display text-lg font-semibold text-slate-900"
                >
                  Confirm Google Form Creation
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  This will create a new form inside your connected Google
                  account with all {SCREENING_EXAM_QUESTIONS.length} screening
                  questions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmCreateOpen(false)}
                aria-label="Close modal"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-form-title"
                className="block text-xs font-medium text-slate-700"
              >
                Google Form Title
              </label>
              <input
                id="new-form-title"
                type="text"
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">
                Included Screening Controls:
              </div>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  Duolingo English Test Overall Score (10–160 scale, minimum{' '}
                  {MIN_DUOLINGO_SCORE} required) + certificate verification link
                </li>
                <li>
                  Practical workplace scenario written in the applicant&apos;s
                  own voice
                </li>
                <li>
                  3 anti-AI trick questions (strict sentence/cliché/city
                  constraint, scheduling logic trap, and hidden prompt-injection
                  canary phrase)
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={creatingForm}
                onClick={() => setConfirmCreateOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingForm || !newFormTitle.trim()}
                onClick={() => void handleConfirmedCreateForm()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {creatingForm
                    ? 'Creating in Google Forms...'
                    : 'Confirm & Create Form'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
