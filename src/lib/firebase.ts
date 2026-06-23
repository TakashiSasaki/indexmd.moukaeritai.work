import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  runTransaction,
  writeBatch,
  onSnapshot
} from "firebase/firestore";

// Read configuration from dynamic firebase-applet-config
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use custom Firestore Database ID if present in config to avoid connection timeouts or database mismatches.
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}),
    experimentalForceLongPolling: true
  }, (firebaseConfig as any).firestoreDatabaseId || "(default)");
} catch (e: any) {
  console.warn("Firestore initialization error (falling back)", e);
  try {
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, (firebaseConfig as any).firestoreDatabaseId || "(default)");
  } catch (e2) {
    db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || "(default)");
  }
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
  }
}

export function formatErrorMessage(error: any): string {
  if (!error) return "不明なエラーが発生しました";
  const msg = error.message || String(error);
  
  if (msg.toLowerCase().includes("quota")) {
    return "🔥 Firebaseデータベースの無料利用枠（クォータ）上限に達しました。処理を継続できません。時間が経つとリセットされます。";
  }
  
  try {
    const parsed = JSON.parse(msg);
    if (parsed.error) {
      if (typeof parsed.error === 'string' && parsed.error.toLowerCase().includes("quota")) {
        return "🔥 Firebaseデータベースの無料利用枠（クォータ）上限に達しました。処理を継続できません。時間が経つとリセットされます。";
      }
      return parsed.error;
    }
  } catch (e) {
    // not json
  }
  
  return msg;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { 
  auth, 
  db, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  updateDoc,
  runTransaction,
  writeBatch,
  onSnapshot
};
export type { User };
