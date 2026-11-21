import {
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import type { ApplicantProfile } from '../types/payroll';
import { MIN_DUOLINGO_SCORE } from '../utils/examBlueprint';

interface ApplicantPortalViewProps {
  profile: ApplicantProfile;
  onSignOut: () => void;
}

export function ApplicantPortalView({
  profile,
  onSignOut,
}: ApplicantPortalViewProps) {
  const humanConfidencePct = Math.max(
    0,
    Math.min(100, 100 - profile.aiLikelihoodPct)
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            Cadence
          </span>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-medium text-slate-600">
            Applicant Portal
          </span>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Screening Exam Verified · Account Active</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Welcome, {profile.name}
            </h1>
            <p className="text-sm text-slate-600">
              {profile.email}
              {profile.targetRole ? ` · Target Role: ${profile.targetRole}` : ''}
            </p>
          </div>

          <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-left sm:text-right shrink-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Registration Code
            </div>
            <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
              {profile.inviteCode}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">
              Duolingo English Test
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-700">
              {profile.duolingoScore} / 160
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Exceeds minimum requirement ({MIN_DUOLINGO_SCORE}+)
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">
              Exam Quality Score
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
              {profile.examScore} / 100
            </div>
            <div className="mt-1 text-xs text-slate-500">
              All screening checks completed
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs font-medium text-slate-500">
              Authenticity Verification
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-blue-700">
              {humanConfidencePct}%
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Human-authored answers verified
            </div>
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Onboarding Progress
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg">
              <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">
                  1. Google Forms Screening Exam Passed
                </div>
                <p className="text-slate-600 mt-0.5">
                  Duolingo proficiency ({profile.duolingoScore}) and anti-AI
                  verification checks passed.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg">
              <KeyRound className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">
                  2. Cadence Applicant Account Activated
                </div>
                <p className="text-slate-600 mt-0.5">
                  Your single-use registration code ({profile.inviteCode}) has
                  been verified and linked to your profile.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-slate-900">
                  3. Recruiter Interview &amp; Placement Coordination
                </div>
                <p className="text-slate-600 mt-0.5">
                  Your recruiter has received confirmation of your Cadence
                  account creation and will reach out at {profile.email} with
                  next steps.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        Cadence Applicant Portal · Verified Candidate Account
      </footer>
    </div>
  );
}
