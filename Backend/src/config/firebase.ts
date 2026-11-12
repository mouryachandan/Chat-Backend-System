import fs from 'node:fs';
import path from 'node:path';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from './env';

let firestoreInstance: Firestore | null = null;

function initFirebaseApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  if (env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({
      projectId: env.FIREBASE_PROJECT_ID || 'demo-chat-backend',
    });
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolvedPath = path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(resolvedPath)) {
      const raw = fs.readFileSync(resolvedPath, 'utf-8');
      const serviceAccount = JSON.parse(raw) as ServiceAccount;
      return initializeApp({
        credential: cert(serviceAccount),
      });
    }
  }

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
    });
  }

  throw new Error(
    'Firebase credentials are not configured. Provide FIREBASE_SERVICE_ACCOUNT_PATH, ' +
      'FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, or FIRESTORE_EMULATOR_HOST.'
  );
}

export function getDb(): Firestore {
  if (!firestoreInstance) {
    const app = initFirebaseApp();
    firestoreInstance = getFirestore(app);
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  }
  return firestoreInstance;
}

