// js/auth/register.js
import { db } from "../firebase.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Config
========================= */
const CLUB_ID = "volcanes"; // si luego lo sacás de config/guard, lo cambiamos

/* =========================
   DOM
========================= */
const form = document.getElementById("registerForm");
const alertBox = document.getElementById("alertBox");

/* =========================
   UI helpers
========================= */
function showAlert(msg, type = "danger") {
  if (!alertBox) return;
  alertBox.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${msg}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function norm(s) {
  return (s || "").toString().trim();
}

function normEmail(s) {
  return norm(s).toLowerCase();
}

function normPhone(s) {
  // normalización básica: solo dígitos (para comparar)
  const digits = (s || "").toString().replace(/\D/g, "");
  return digits || "";
}

/* =========================
   Match helpers (Roster / Association)
========================= */
async function findByEmailOrPhone(colName, clubId, email, phoneDigits) {
  // 1) email
  if (email) {
    const q1 = query(
      collection(db, colName),
      where("clubId", "==", clubId),
      where("email", "==", email)
    );
    const s1 = await getDocs(q1);
    if (!s1.empty) return { id: s1.docs[0].id, ...s1.docs[0].data() };
  }

  // 2) phone (si la colección guarda phone normalizado o phone con dígitos)
  if (phoneDigits) {
    // Intento A: campo phoneDigits (recomendado)
    const q2 = query(
      collection(db, colName),
      where("clubId", "==", clubId),
      where("phoneDigits", "==", phoneDigits)
    );
    const s2 = await getDocs(q2);
    if (!s2.empty) return { id: s2.docs[0].id, ...s2.docs[0].data() };

    // Intento B: campo phone (si guardás solo dígitos)
    const q3 = query(
      collection(db, colName),
      where("clubId", "==", clubId),
      where("phone", "==", phoneDigits)
    );
    const s3 = await getDocs(q3);
    if (!s3.empty) return { id: s3.docs[0].id, ...s3.docs[0].data() };
  }

  return null;
}

async function findPlayer(clubId, email, phoneDigits) {
  // Ajustá el nombre de la colección si tu roster usa otro
  return findByEmailOrPhone("club_players", clubId, email, phoneDigits);
}

async function findAssociation(clubId, email, phoneDigits) {
  // Ajustá el nombre de la colección si tu asociación usa otro
  return findByEmailOrPhone("association_members", clubId, email, phoneDigits);
}

/* =========================
   Submit
========================= */
const auth = getAuth();

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showAlert("", "danger");
  if (alertBox) alertBox.innerHTML = "";

  const fullName = norm(document.getElementById("fullName")?.value);
  const email = normEmail(document.getElementById("email")?.value);
  const phoneRaw = norm(document.getElementById("phone")?.value);
  const phoneDigits = normPhone(phoneRaw);
  const password = document.getElementById("password")?.value || "";

  if (!fullName || !email || !password) {
    showAlert("Completá nombre, email y contraseña.");
    return;
  }
  if (password.length < 6) {
    showAlert("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  try {
    // 0) Buscar match antes de crear user (para decidir roles/status)
    const [player, assoc] = await Promise.all([
      findPlayer(CLUB_ID, email, phoneDigits),
      findAssociation(CLUB_ID, email, phoneDigits)
    ]);

    const roles = {
      player: !!player,
      association: !!assoc,
      admin: false
    };

    const status = (roles.player || roles.association) ? "active" : "pending";

    // 1) Crear usuario en Auth
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 2) Set displayName (opcional)
    try {
      await updateProfile(user, { displayName: fullName });
    } catch (_) {
      // no bloquea
    }

    // 3) Crear users/{uid}
    const userRef = doc(db, "users", user.uid);

    await setDoc(userRef, {
      uid: user.uid,
      clubId: CLUB_ID,

      fullName,
      email,
      phone: phoneRaw || null,
      phoneDigits: phoneDigits || null,

      roles,
      status,

      playerId: player ? player.id : null,
      associationId: assoc ? assoc.id : null,

      createdAt: serverTimestamp(),
      linkedAt: (roles.player || roles.association) ? serverTimestamp() : null
    });

    // 4) Backlinks opcionales (recomendado)
    // Si tu modelo NO quiere backlinks, podés borrar este bloque.
    const updates = [];

    if (player?.id) {
      const playerRef = doc(db, "club_players", player.id);
      updates.push(updateDoc(playerRef, { userId: user.uid }));
    }

    if (assoc?.id) {
      const assocRef = doc(db, "association_members", assoc.id);
      updates.push(updateDoc(assocRef, { userId: user.uid }));
    }

    if (updates.length) {
      await Promise.allSettled(updates);
    }

    // 5) Redirect
    if (roles.association) {
      window.location.href = "association.html";
      return;
    }

    if (roles.player) {
      window.location.href = "dashboard.html";
      return;
    }

    // pending (no match)
    window.location.href = "pending.html?type=register";
  } catch (err) {
    console.error(err);

    // mensajes más amigables
    let msg = err?.message || "Error creando la cuenta.";
    if (err?.code === "auth/email-already-in-use") msg = "Ese correo ya está registrado. Probá iniciar sesión.";
    if (err?.code === "auth/invalid-email") msg = "Ese correo no es válido.";
    if (err?.code === "auth/weak-password") msg = "La contraseña es muy débil (mínimo 6 caracteres).";

    showAlert(msg, "danger");
  }
});
