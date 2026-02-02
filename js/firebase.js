// firebase.js
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { APP_CONFIG } from "./config.js";

function getFirebaseConfig() {
  const cfg = APP_CONFIG?.firebase;

  if (!cfg?.apiKey || !cfg?.authDomain || !cfg?.projectId) {
    throw new Error(
      "Falta APP_CONFIG.firebase (apiKey, authDomain, projectId). Revisa config.js"
    );
  }
  return cfg;
}

const app = getApps().length ? getApps()[0] : initializeApp(getFirebaseConfig());
export const db = getFirestore(app);
export { app };