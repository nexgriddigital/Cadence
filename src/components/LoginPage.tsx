import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseContext';

export function LoginPage() {
  const { signInWithGoogle, signingIn, authError } = useFirebaseAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900">
          Cadence
        </span>
        <span className="text-xs text-slate-500">
          Recruiting Commission & Payout Ledger
        </span>
      </header>

      <main className="max-w-md w-full mx-auto my-auto py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Sign in to your recruiting commission ledger
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Track recruited employee payouts, automatic base commissions, milestone bonuses, and payment rails in one private workspace.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={signingIn}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>

          <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                Automatic commission rates, high-pay bonuses, and 90-day retention triggers
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="w-4 h-4 text-blue-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                Real-time cloud sync across all your devices, protected by Firebase Authentication and owner-isolated Firestore rules
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500">
        Cadence Payroll & Commissions · Authenticated Workspace
      </footer>
    </div>
  );
}
