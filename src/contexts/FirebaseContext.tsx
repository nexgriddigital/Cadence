import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  authNotice: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  clearAuthMessages: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function formatAuthError(error: unknown, fallback: string): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing authentication.';
    case 'auth/popup-blocked':
      return 'Browser blocked the sign-in popup. Allow popups for this site and try again.';
    case 'auth/unauthorized-domain': {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Domain "${host}" is not authorized in Firebase Authentication. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`;
    }
    case 'auth/operation-not-allowed':
      return 'Email/Password authentication is not enabled yet in Firebase Console. Enable it under Authentication → Sign-in method → Email/Password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password. Please check your credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few moments before trying again.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication. Check your connection and try again.';
    default:
      return error instanceof Error ? error.message : fallback;
  }
}

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [, setUserVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
      },
      (error) => {
        setAuthError(
          formatAuthError(error, 'Unable to initialize authentication.')
        );
        setAuthReady(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(
        formatAuthError(error, 'Unable to sign in with Google right now.')
      );
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuthError('Please enter both your email address and password.');
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
    } catch (error) {
      setAuthError(formatAuthError(error, 'Unable to sign in right now.'));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setAuthError('Enter your email address first to receive a password reset link.');
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setAuthNotice(
        `Password reset email sent to ${trimmedEmail}. Check your inbox and spam folder.`
      );
    } catch (error) {
      setAuthError(
        formatAuthError(error, 'Unable to send password reset email right now.')
      );
    } finally {
      setSigningIn(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthNotice(
        `Verification email resent to ${auth.currentUser.email ?? 'your inbox'}.`
      );
    } catch (error) {
      setAuthError(
        formatAuthError(error, 'Unable to resend verification email right now.')
      );
    } finally {
      setSigningIn(false);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setSigningIn(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const refreshed = auth.currentUser;
      setUser(refreshed);
      setUserVersion((v) => v + 1);
      if (!refreshed.emailVerified) {
        setAuthNotice(
          'Email is not verified yet. Open the verification link in your inbox, then click Continue again.'
        );
        return false;
      }
      return true;
    } catch (error) {
      setAuthError(
        formatAuthError(error, 'Unable to refresh verification status.')
      );
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    setAuthNotice(null);
    await signOut(auth);
  }, []);

  const clearAuthMessages = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authReady,
      signingIn,
      authError,
      authNotice,
      signInWithGoogle,
      signInWithEmail,
      sendPasswordReset,
      resendVerificationEmail,
      refreshUser,
      signOutUser,
      clearAuthMessages,
    }),
    [
      user,
      authReady,
      signingIn,
      authError,
      authNotice,
      signInWithGoogle,
      signInWithEmail,
      sendPasswordReset,
      resendVerificationEmail,
      refreshUser,
      signOutUser,
      clearAuthMessages,
    ]
  );

  return (
    <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>
  );
}

export function useFirebaseAuth() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseAuth must be used inside FirebaseProvider');
  }
  return ctx;
}
