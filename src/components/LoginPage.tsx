import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseContext';

export function VerifyEmailView() {
  const {
    user,
    signingIn,
    authError,
    authNotice,
    resendVerificationEmail,
    refreshUser,
    signOutUser,
  } = useFirebaseAuth();

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
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <MailCheck className="w-5 h-5" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Verify your email address
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              We sent a verification link to{' '}
              <span className="font-medium text-slate-900">
                {user?.email ?? 'your email address'}
              </span>
              . Open the link to verify your account before accessing your
              private ledger.
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

          {authNotice && (
            <div
              role="status"
              className="p-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              {authNotice}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => void refreshUser()}
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {signingIn ? 'Checking status...' : "I've verified — Continue"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void resendVerificationEmail()}
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Resend verification email
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Wrong email address?</span>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500">
        Cadence Payroll & Commissions · Authenticated Workspace
      </footer>
    </div>
  );
}

export function LoginPage() {
  const {
    signInWithGoogle,
    signInWithEmail,
    sendPasswordReset,
    signingIn,
    authError,
    authNotice,
  } = useFirebaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void signInWithEmail(email, password);
  };

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

      <main className="max-w-md w-full mx-auto my-auto py-10">
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

          {authNotice && (
            <div
              role="status"
              className="p-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              {authNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={() => void sendPasswordReset(email)}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-3 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <span>{signingIn ? 'Signing in...' : 'Sign in with Email'}</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </form>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400">or</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={signingIn}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 border border-slate-200 text-sm font-medium rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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
            <span>Continue with Google</span>
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
