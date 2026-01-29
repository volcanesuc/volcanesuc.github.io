// js/auth.js
import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    alert("Error al iniciar sesión");
  }
}

export function watchAuth(redirectIfLoggedOut = true) {
  onAuthStateChanged(auth, user => {
    if (!user && redirectIfLoggedOut) {
      window.location.href = "index.html";
    }
  });
}

export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}