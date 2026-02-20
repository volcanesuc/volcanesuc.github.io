// js/auth/role-routing.js
import { db } from "./firebase.js";
import { APP_CONFIG } from "../config/config.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function clubId() {
  // ajustá si tu APP_CONFIG usa otro nombre
  return APP_CONFIG?.clubId || APP_CONFIG?.club?.id || "volcanes";
}

async function ensureUserDoc(firebaseUser) {
  const uid = firebaseUser.uid;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return { created: false, data: snap.data() };

  const payload = {
    uid,
    clubId: clubId(),

    // data google
    email: firebaseUser.email || null,
    displayName: firebaseUser.displayName || null,
    photoURL: firebaseUser.photoURL || null,
    phoneNumber: firebaseUser.phoneNumber || null,
    providerId: firebaseUser.providerData?.[0]?.providerId || "google",

    profileStatus: "pending", // lo completa en register
    isActive: true,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(ref, payload, { merge: true });
  return { created: true, data: payload };
}

/**
 * Regla:
 * 1) Si existe user_roles/{uid} y active=true y clubId match -> dashboard
 * 2) Si user existe en Google pero sin rol: ensure users/{uid} -> register
 * 3) Si recién creado igual -> register
 */
export async function routeAfterGoogleLogin(firebaseUser) {
  const uid = firebaseUser.uid;

  const roleRef = doc(db, "user_roles", uid);
  const roleSnap = await getDoc(roleRef);

  if (roleSnap.exists()) {
    const r = roleSnap.data();
    if (r?.active === true && r?.clubId === clubId()) {
      window.location.href = "dashboard.html";
      return;
    }
  }

  const ensured = await ensureUserDoc(firebaseUser);
  const createdFlag = ensured.created ? "1" : "0";

  // register en raíz
  window.location.href = `register.html?created=${createdFlag}`;
}
