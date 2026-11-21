import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const configWithOptionalDb = firebaseConfig as typeof firebaseConfig & {
  firestoreDatabaseId?: string;
};
export const db = configWithOptionalDb.firestoreDatabaseId
  ? getFirestore(app, configWithOptionalDb.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const GOOGLE_FORMS_SCOPES = [
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
] as const;

export const googleProvider = new GoogleAuthProvider();
for (const scope of GOOGLE_FORMS_SCOPES) {
  googleProvider.addScope(scope);
}
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const googleFormsConnectProvider = new GoogleAuthProvider();
for (const scope of GOOGLE_FORMS_SCOPES) {
  googleFormsConnectProvider.addScope(scope);
}
googleFormsConnectProvider.setCustomParameters({
  prompt: 'consent select_account',
});

// Strictly in-memory OAuth access token cache (never persisted to localStorage/sessionStorage)
let inMemoryFormsAccessToken: string | null = null;

export function getFormsAccessToken(): string | null {
  return inMemoryFormsAccessToken;
}

export function setFormsAccessToken(token: string | null): void {
  inMemoryFormsAccessToken = token;
}

export function clearFormsAccessToken(): void {
  inMemoryFormsAccessToken = null;
}

export const DESIGNATED_OWNER_UID = '82SIYo8O2hdtNqBAH8stAkPBZYq2';

export function isWorkspaceAccessAllowed(
  user: { uid: string; emailVerified: boolean } | null
): boolean {
  if (!user) return false;
  return user.emailVerified || user.uid === DESIGNATED_OWNER_UID;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
