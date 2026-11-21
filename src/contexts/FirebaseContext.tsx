import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  clearFormsAccessToken,
  db,
  googleFormsConnectProvider,
  googleProvider,
  setFormsAccessToken,
} from '../firebase';
import type { ApplicantProfile } from '../types/payroll';

export interface ApplicantRegistrationInput {
  inviteCode: string;
  name: string;
  email: string;
  password: string;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  applicantProfile: ApplicantProfile | null;
  profileLoading: boolean;
  signingIn: boolean;
  authError: string | null;
  authNotice: string | null;
  formsAccessToken: string | null;
  connectingForms: boolean;
  formsAuthError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerApplicantWithInviteCode: (
    input: ApplicantRegistrationInput
  ) => Promise<boolean>;
  connectGoogleForms: () => Promise<string | null>;
  clearGoogleFormsToken: () => void;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  clearAuthMessages: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

const INVITE_CODE_PATTERN = /^CAD-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

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
      return 'Email/Password authentication or sign-up is disabled in Firebase Console. Verify Email/Password is enabled under Authentication → Sign-in method and "Enable create (sign-up)" is checked under Settings → User actions.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Switch to Applicant Sign In instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Choose a password with at least 6 characters.';
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
  const [applicantProfile, setApplicantProfile] =
    useState<ApplicantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [formsAccessToken, setFormsTokenState] = useState<string | null>(null);
  const [connectingForms, setConnectingForms] = useState(false);
  const [formsAuthError, setFormsAuthError] = useState<string | null>(null);
  const [, setUserVersion] = useState(0);

  const registeringApplicantRef = useRef(false);
  const lastUidRef = useRef<string | null>(null);

  const updateFormsToken = useCallback((token: string | null) => {
    setFormsAccessToken(token);
    setFormsTokenState(token);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (registeringApplicantRef.current) {
          return;
        }

        const prevUid = lastUidRef.current;
        const nextUid = nextUser?.uid ?? null;
        if (!nextUser || (prevUid && prevUid !== nextUid)) {
          clearFormsAccessToken();
          setFormsTokenState(null);
          setFormsAuthError(null);
        }
        lastUidRef.current = nextUid;
        setUser(nextUser);

        if (!nextUser) {
          setApplicantProfile(null);
          setProfileLoading(false);
          setAuthReady(true);
          return;
        }

        setProfileLoading(true);
        void getDoc(doc(db, 'applicantProfiles', nextUser.uid))
          .then((snap) => {
            if (snap.exists()) {
              const d = snap.data();
              setApplicantProfile({
                uid: String(d.uid ?? nextUser.uid),
                recruiterUid: String(d.recruiterUid ?? ''),
                inviteCode: String(d.inviteCode ?? ''),
                name: String(d.name ?? nextUser.displayName ?? ''),
                email: String(d.email ?? nextUser.email ?? ''),
                targetRole: String(d.targetRole ?? ''),
                duolingoScore: Number(d.duolingoScore ?? 100),
                examScore: Number(d.examScore ?? 0),
                aiLikelihoodPct: Number(d.aiLikelihoodPct ?? 0),
                status: 'Approved',
              });
            } else {
              setApplicantProfile(null);
            }
          })
          .catch(() => {
            setApplicantProfile(null);
          })
          .finally(() => {
            setProfileLoading(false);
            setAuthReady(true);
          });
      },
      (error) => {
        setAuthError(
          formatAuthError(error, 'Unable to initialize authentication.')
        );
        setProfileLoading(false);
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
      const result = await signInWithPopup(auth, googleProvider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      if (cred?.accessToken) {
        updateFormsToken(cred.accessToken);
      }
    } catch (error) {
      setAuthError(
        formatAuthError(error, 'Unable to sign in with Google right now.')
      );
    } finally {
      setSigningIn(false);
    }
  }, [updateFormsToken]);

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

  const registerApplicantWithInviteCode = useCallback(
    async (input: ApplicantRegistrationInput): Promise<boolean> => {
      const code = input.inviteCode.trim().toUpperCase();
      const email = input.email.trim().toLowerCase();
      const name = input.name.trim();
      const password = input.password;

      if (!INVITE_CODE_PATTERN.test(code)) {
        setAuthError(
          'Enter a valid registration code in the format CAD-XXXX-XXXX issued after passing the screening exam.'
        );
        return false;
      }
      if (!name || !email || password.length < 6) {
        setAuthError(
          'Enter your full name, approved email address, and a password of at least 6 characters.'
        );
        return false;
      }

      setSigningIn(true);
      setAuthError(null);
      setAuthNotice(null);
      registeringApplicantRef.current = true;

      let createdUser: User | null = null;

      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        createdUser = credential.user;
        await createdUser.getIdToken(true);

        const inviteRef = doc(db, 'applicantInvites', code);
        let inviteSnap;
        try {
          inviteSnap = await getDoc(inviteRef);
        } catch {
          inviteSnap = null;
        }

        if (!inviteSnap || !inviteSnap.exists()) {
          await deleteUser(createdUser);
          createdUser = null;
          setAuthError(
            'Registration code is invalid, already used, revoked, or does not match this email address. Use the exact email you submitted in your passing screening exam.'
          );
          return false;
        }

        const inviteData = inviteSnap.data();
        if (
          inviteData.status !== 'Active' ||
          String(inviteData.applicantEmail ?? '').toLowerCase() !== email
        ) {
          await deleteUser(createdUser);
          createdUser = null;
          setAuthError(
            'This registration code is no longer active or does not match your email address.'
          );
          return false;
        }

        const resolvedName = (
          name || String(inviteData.applicantName ?? 'Applicant')
        ).slice(0, 120);
        await updateProfile(createdUser, { displayName: resolvedName });

        const profilePayload = {
          uid: createdUser.uid,
          recruiterUid: String(inviteData.recruiterUid),
          inviteCode: code,
          name: resolvedName,
          email,
          targetRole: String(inviteData.targetRole ?? '').slice(0, 120),
          duolingoScore: Number(inviteData.duolingoScore ?? 100),
          examScore: Number(inviteData.examScore ?? 0),
          aiLikelihoodPct: Number(inviteData.aiLikelihoodPct ?? 0),
          status: 'Approved' as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const batch = writeBatch(db);
        batch.set(doc(db, 'applicantProfiles', createdUser.uid), profilePayload);
        batch.update(inviteRef, {
          status: 'Used',
          usedByUid: createdUser.uid,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();

        lastUidRef.current = createdUser.uid;
        setUser(createdUser);
        setApplicantProfile({
          uid: profilePayload.uid,
          recruiterUid: profilePayload.recruiterUid,
          inviteCode: profilePayload.inviteCode,
          name: profilePayload.name,
          email: profilePayload.email,
          targetRole: profilePayload.targetRole,
          duolingoScore: profilePayload.duolingoScore,
          examScore: profilePayload.examScore,
          aiLikelihoodPct: profilePayload.aiLikelihoodPct,
          status: 'Approved',
        });
        setProfileLoading(false);
        setAuthReady(true);
        return true;
      } catch (error) {
        if (createdUser) {
          try {
            await deleteUser(createdUser);
          } catch {
            await signOut(auth);
          }
        }
        setAuthError(
          formatAuthError(
            error,
            'Unable to verify your registration code and create your account.'
          )
        );
        return false;
      } finally {
        registeringApplicantRef.current = false;
        setSigningIn(false);
      }
    },
    []
  );

  const connectGoogleForms = useCallback(async (): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) {
      setFormsAuthError('Sign in to Cadence first before connecting Google Forms.');
      return null;
    }

    setConnectingForms(true);
    setFormsAuthError(null);

    try {
      const hasGoogleProvider = current.providerData.some(
        (p) => p.providerId === 'google.com'
      );
      const result = hasGoogleProvider
        ? await reauthenticateWithPopup(current, googleFormsConnectProvider)
        : await linkWithPopup(current, googleFormsConnectProvider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      const token = cred?.accessToken ?? null;
      if (!token) {
        setFormsAuthError(
          'Google did not return a Forms access token. Please try connecting again and grant Forms permissions.'
        );
        return null;
      }
      updateFormsToken(token);
      return token;
    } catch (error) {
      // If the Google account is already linked to another Firebase user,
      // Firebase still attaches the OAuth access token to the error credential so
      // the Email/Password owner can use Google Forms without switching accounts.
      const errorCred = GoogleAuthProvider.credentialFromError(
        error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
      );
      if (errorCred?.accessToken) {
        updateFormsToken(errorCred.accessToken);
        return errorCred.accessToken;
      }

      setFormsAuthError(
        formatAuthError(
          error,
          'Unable to connect Google Forms right now. Ensure popups are allowed and grant Forms access.'
        )
      );
      return null;
    } finally {
      setConnectingForms(false);
    }
  }, [updateFormsToken]);

  const clearGoogleFormsToken = useCallback(() => {
    updateFormsToken(null);
    setFormsAuthError(null);
  }, [updateFormsToken]);

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
    setFormsAuthError(null);
    updateFormsToken(null);
    setApplicantProfile(null);
    await signOut(auth);
  }, [updateFormsToken]);

  const clearAuthMessages = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authReady,
      applicantProfile,
      profileLoading,
      signingIn,
      authError,
      authNotice,
      formsAccessToken,
      connectingForms,
      formsAuthError,
      signInWithGoogle,
      signInWithEmail,
      registerApplicantWithInviteCode,
      connectGoogleForms,
      clearGoogleFormsToken,
      sendPasswordReset,
      resendVerificationEmail,
      refreshUser,
      signOutUser,
      clearAuthMessages,
    }),
    [
      user,
      authReady,
      applicantProfile,
      profileLoading,
      signingIn,
      authError,
      authNotice,
      formsAccessToken,
      connectingForms,
      formsAuthError,
      signInWithGoogle,
      signInWithEmail,
      registerApplicantWithInviteCode,
      connectGoogleForms,
      clearGoogleFormsToken,
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
