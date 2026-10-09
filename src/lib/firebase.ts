
import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== "measurementId" && !value)
  .map(([key]) => key);

if (missingConfig.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingConfig.join(", ")}`
  );
}

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const realtimeDb = getDatabase(firebaseApp);
export { firebaseApp };
