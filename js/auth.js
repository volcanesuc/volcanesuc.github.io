// js/auth.js
import { auth } from "./firebase.js";
import { db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const provider = new GoogleAuthProvider();

/* =========================================================
   Google Login (forced)
   - Si users/{uid}.onboardingComplete === true => dashboard
   - Si no => public/register.html?google=1
========================================================= */
export async function loginWithGoogle(opts = {}) {
  const dashboardPath = opts.dashboardPath ?? "dashboard.html";
  const registerPath = opts.registerPath ?? "public/register.html?google=1";

  try {
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    const email = (user.email || "").toLowerCase();

    // siempre prefill
    sessionStorage.setItem(
      "prefill_register",
      JSON.stringify({
        fullName: user.displayName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
      })
    );

    if (snap.exists()) {
      const data = snap.data() || {};
      const done = data.onboardingComplete === true; // si falta => false

      // mantener email actualizado
      if (email && data.email !== email) {
        await setDoc(
          userRef,
          { email, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }

      window.location.href = done ? dashboardPath : registerPath;
      return;
    }

    // no existe => crear doc mínimo y mandar a register
    await setDoc(
      userRef,
      {
        email: email || null,
        onboardingComplete: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    window.location.href = registerPath;
  } catch (err) {
    console.error(err);
    alert("Error al iniciar sesión");
  }
}

/* =========================================================
   Guard / watchAuth
========================================================= */
export function watchAuth(onLoggedIn, opts = {}) {
  const redirectTo = opts.redirectTo ?? "/index.html";

  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace(redirectTo);
      return;
    }
    onLoggedIn?.(user);
  });
}

/* =========================================================
   Logout
========================================================= */
export async function logout(opts = {}) {
  const redirectTo = opts.redirectTo ?? "index.html";
  await signOut(auth);
  window.location.href = redirectTo;
}
