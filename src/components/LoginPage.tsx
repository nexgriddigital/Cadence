import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseContext';

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
          Recruiting Commission &amp; Payout Ledger
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
        Cadence Payroll &amp; Commissions · Authenticated Workspace
      </footer>
    </div>
  );
}

type PortalRole = 'recruiter' | 'applicant';
type ApplicantAuthMode = 'signin' | 'register';

export function LoginPage() {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerApplicantWithInviteCode,
    sendPasswordReset,
    clearAuthMessages,
    signingIn,
    authError,
    authNotice,
  } = useFirebaseAuth();

  const [portalRole, setPortalRole] = useState<PortalRole>('recruiter');
  const [applicantMode, setApplicantMode] =
    useState<ApplicantAuthMode>('signin');

  // Shared credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Applicant invite-code registration fields
  const [inviteCode, setInviteCode] = useState('');
  const [fullName, setFullName] = useState('');

  const switchPortal = (nextRole: PortalRole) => {
    setPortalRole(nextRole);
    clearAuthMessages();
  };

  const switchApplicantMode = (nextMode: ApplicantAuthMode) => {
    setApplicantMode(nextMode);
    clearAuthMessages();
  };

  const handleRecruiterSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void signInWithEmail(email, password);
  };

  const handleApplicantSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (applicantMode === 'signin') {
      void signInWithEmail(email, password);
    } else {
      void registerApplicantWithInviteCode({
        inviteCode,
        name: fullName,
        email,
        password,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900">
          Cadence
        </span>
        <span className="text-xs text-slate-500">
          Recruiting Commission &amp; Applicant Portal
        </span>
      </header>

      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Role Switcher */}
          <div
            role="tablist"
            aria-label="Account type"
            className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/70"
          >
            <button
              type="button"
              role="tab"
              aria-selected={portalRole === 'recruiter'}
              onClick={() => switchPortal('recruiter')}
              className={`py-3.5 px-4 text-xs font-semibold transition-colors border-b-2 ${
                portalRole === 'recruiter'
                  ? 'border-blue-700 text-blue-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Recruiter Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={portalRole === 'applicant'}
              onClick={() => switchPortal('applicant')}
              className={`py-3.5 px-4 text-xs font-semibold transition-colors border-b-2 ${
                portalRole === 'applicant'
                  ? 'border-blue-700 text-blue-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Applicant Portal
            </button>
          </div>

          <div className="p-8 space-y-6">
            {portalRole === 'recruiter' ? (
              <>
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
                    Sign in to your recruiting ledger
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Access employee payouts, commission rules, applicants, and
                    Google Forms screening exams.
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

                <form onSubmit={handleRecruiterSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="recruiter-email"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Email Address
                    </label>
                    <input
                      id="recruiter-email"
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
                        htmlFor="recruiter-password"
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
                        id="recruiter-password"
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
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
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
                    <span>
                      {signingIn ? 'Signing in...' : 'Sign in with Email'}
                    </span>
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
                  className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 border border-slate-300 text-sm font-medium rounded-lg shadow-2xs transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <OfficialGoogleLogo />
                  <span>Sign in with Google</span>
                </button>

                <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Recruiter accounts are administrator-provisioned only
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck
                      className="w-4 h-4 text-blue-700 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Owner-isolated Firestore security rules &amp; Google Forms
                      screening integration
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
                    {applicantMode === 'signin'
                      ? 'Applicant Sign In'
                      : 'Create Applicant Account'}
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {applicantMode === 'signin'
                      ? 'Sign in to view your verified exam scores and onboarding status.'
                      : 'Passed the Duolingo 100+ Google Forms screening exam? Enter your unique registration code below to create your account.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => switchApplicantMode('signin')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      applicantMode === 'signin'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchApplicantMode('register')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      applicantMode === 'register'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Create Account
                  </button>
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

                <form onSubmit={handleApplicantSubmit} className="space-y-4">
                  {applicantMode === 'register' && (
                    <>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="applicant-invite-code"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Registration Code *
                        </label>
                        <div className="relative">
                          <KeyRound
                            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="applicant-invite-code"
                            type="text"
                            required
                            value={inviteCode}
                            onChange={(e) =>
                              setInviteCode(e.target.value.toUpperCase())
                            }
                            placeholder="CAD-XXXX-XXXX"
                            className="w-full pl-9 pr-3 py-2.5 text-sm font-mono uppercase tracking-wider bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Required: generated exclusively for applicants who
                          passed the screening exam.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="applicant-full-name"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Full Name *
                        </label>
                        <input
                          id="applicant-full-name"
                          type="text"
                          required
                          autoComplete="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your full name"
                          className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="applicant-email"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {applicantMode === 'register'
                        ? 'Approved Exam Email Address *'
                        : 'Email Address'}
                    </label>
                    <input
                      id="applicant-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="applicant@example.com"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="applicant-password"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Password
                      </label>
                      {applicantMode === 'signin' && (
                        <button
                          type="button"
                          disabled={signingIn}
                          onClick={() => void sendPasswordReset(email)}
                          className="text-xs font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="applicant-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete={
                          applicantMode === 'register'
                            ? 'new-password'
                            : 'current-password'
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          applicantMode === 'register'
                            ? 'Create a password (min 6 characters)'
                            : 'Enter your password'
                        }
                        className="w-full pl-3 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
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
                    <span>
                      {signingIn
                        ? applicantMode === 'register'
                          ? 'Verifying code & creating account...'
                          : 'Signing in...'
                        : applicantMode === 'register'
                          ? 'Verify Code & Create Account'
                          : 'Sign in to Applicant Portal'}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <UserCheck
                      className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Registration codes are single-use, email-locked, and only
                      issued to applicants with Duolingo 100+ who pass our
                      anti-AI screening exam.
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500">
        Cadence Payroll &amp; Recruiting · Authenticated Workspace
      </footer>
    </div>
  );
}
