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

    const snap = await getDoc(doc(db, "users", user.uid));

    if (snap.exists()) {
      window.location.href = "dashboard.html";
      return;
    }

    // No tiene perfil todavía → mandar a completar registro
    sessionStorage.setItem("prefill_register", JSON.stringify({
      fullName: user.displayName || "",
      email: user.email || "",
      phone: user.phoneNumber || ""
    }));

    window.location.href = "pages/public/register.html?google=1";

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