
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  cert,
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAdminApp() {
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error("Missing Firebase service account");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  return getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: "aevora-realtime",
      });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const authorization = req.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      error: "Missing access token",
    });
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return res.status(401).json({
      error: "Missing access token",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: "Server configuration is incomplete",
    });
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid or expired access token",
      });
    }

    const firebaseApp = getFirebaseAdminApp();

    const customToken = await getAuth(
      firebaseApp,
    ).createCustomToken(user.id);

    return res.status(200).json({
      token: customToken,
    });
  } catch {
    return res.status(500).json({
      error: "Unable to create Firebase token",
    });
  }
}
