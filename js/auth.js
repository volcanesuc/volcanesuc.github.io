// js/auth.js
import { auth } from "./firebase.js";
import { db } from "./firebase.js";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    const email = (user.email || "").toLowerCase();

    // Si ya existe y ya completó onboarding => dashboard
    if (snap.exists()) {
      const data = snap.data() || {};
      const done = data.onboardingComplete === true;

      // mantener email actualizado (sin romper nada)
      if (email && data.email !== email) {
        await setDoc(userRef, { email, updatedAt: serverTimestamp() }, { merge: true });
      }

      if (done) {
        window.location.href = "dashboard.html";
        return;
      }

      // existe pero NO está completo => mandar a register
      sessionStorage.setItem(
        "prefill_register",
        JSON.stringify({
          fullName: user.displayName || "",
          email: user.email || "",
          phone: user.phoneNumber || ""
        })
      );

      window.location.href = "public/register.html?google=1";
      return;
    }

    // No existe => crear doc mínimo y mandar a register
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

    sessionStorage.setItem(
      "prefill_register",
      JSON.stringify({
        fullName: user.displayName || "",
        email: user.email || "",
        phone: user.phoneNumber || ""
      })
    );

    window.location.href = "public/register.html?google=1";
  } catch (err) {
    console.error(err);
    alert("Error al iniciar sesión");
  }
}


export function watchAuth(onLoggedIn, opts = {}) {
  const redirectTo = opts.redirectTo ?? "/index.html";

  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      //replace evita volver atrás al “pantallazo” protegido
      window.location.replace(redirectTo);
      return;
    }
    onLoggedIn?.(user);
  });
}

export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}