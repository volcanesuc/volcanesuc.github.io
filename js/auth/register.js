import "../firebase.js";
import { db } from "../firebase.js";
import { loadHeader } from "../components/header.js";
import { loginWithGoogle, logout } from "../auth.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage,
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* =========================
   Config / Collections
========================= */
const COL_PLANS = "subscription_plans";
const COL_ASSOC = "associates";
const COL_PLAYERS = "club_players";
const COL_MEMBERSHIPS = "memberships";
const COL_SUBMISSIONS = "membership_payment_submissions";

// config doc sugerido
const CFG_DOC = doc(db, "club_config", "public_registration");

/* =========================
   DOM
========================= */
const $ = {
  alertBox: document.getElementById("alertBox"),
  form: document.getElementById("registerForm"),
  submitBtn: document.getElementById("submitBtn"),

  googleBtn: document.getElementById("googleBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  firstName: document.getElementById("firstName"),
  lastName: document.getElementById("lastName"),
  birthDate: document.getElementById("birthDate"),
  idType: document.getElementById("idType"),
  idNumber: document.getElementById("idNumber"),
  email: document.getElementById("email"),

  province: document.getElementById("province"),
  canton: document.getElementById("canton"),

  planId: document.getElementById("planId"),
  planMeta: document.getElementById("planMeta"),
  proofFile: document.getElementById("proofFile"),

  declarationWrap: document.getElementById("declarationWrap"),
  infoDeclaration: document.getElementById("infoDeclaration"),
  infoDeclarationLabel: document.getElementById("infoDeclarationLabel"),

  termsWrap: document.getElementById("termsWrap"),
  termsAccepted: document.getElementById("termsAccepted"),
  termsLink: document.getElementById("termsLink"),
};

const auth = getAuth();
const storage = getStorage();

/* =========================
   Helpers
========================= */
function showAlert(msg, type = "danger") {
  if (!$.alertBox) return;
  $.alertBox.className = `alert alert-${type}`;
  $.alertBox.textContent = msg;
  $.alertBox.classList.remove("d-none");
}

function hideAlert() {
  $.alertBox?.classList.add("d-none");
}

function setLoading(isLoading) {
  document.body.classList.toggle("loading", isLoading);
  if ($.submitBtn) $.submitBtn.disabled = isLoading;
  if ($.googleBtn) $.googleBtn.disabled = isLoading;
  if ($.logoutBtn) $.logoutBtn.disabled = isLoading;
}

function norm(s) {
  return (s || "").toString().trim();
}

function cleanIdNum(s) {
  return norm(s).replace(/\s+/g, "");
}

function fmtMoney(n, cur = "CRC") {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: cur }).format(v);
}

/* =========================
   Costa Rica: Provincia/Cantón (mínimo viable)
   (si quieres, lo movemos a un json)
========================= */
const CR = {
  "San José": ["San José", "Escazú", "Desamparados", "Goicoechea", "Santa Ana", "Curridabat"],
  "Alajuela": ["Alajuela", "San Ramón", "Grecia", "Atenas"],
  "Cartago": ["Cartago", "Paraíso", "La Unión"],
  "Heredia": ["Heredia", "Barva", "Santo Domingo", "San Rafael"],
  "Guanacaste": ["Liberia", "Nicoya", "Santa Cruz"],
  "Puntarenas": ["Puntarenas", "Esparza", "Garabito"],
  "Limón": ["Limón", "Pococí", "Siquirres"],
};

function fillProvinceCanton() {
  const provinces = Object.keys(CR);

  $.province.innerHTML = `<option value="">Seleccionar…</option>` +
    provinces.map(p => `<option value="${p}">${p}</option>`).join("");

  $.canton.innerHTML = `<option value="">Seleccionar…</option>`;

  $.province.addEventListener("change", () => {
    const p = $.province.value;
    const cantons = CR[p] || [];
    $.canton.innerHTML = `<option value="">Seleccionar…</option>` +
      cantons.map(c => `<option value="${c}">${c}</option>`).join("");
  });
}

/* =========================
   Header: sin tabs aquí
========================= */
const NO_TABS_CFG = { enabledTabs: {} };
loadHeader("home", NO_TABS_CFG);

/* =========================
   Auto-login ?google=1
========================= */
(async () => {
  const params = new URLSearchParams(location.search);
  if (params.get("google") === "1") {
    try {
      await loginWithGoogle();
    } catch (e) {
      console.warn(e);
      showAlert("No se pudo iniciar sesión con Google. Intenta de nuevo.");
    }
  }
})();

/* =========================
   Auth UI
========================= */
$.googleBtn?.addEventListener("click", async () => {
  hideAlert();
  try {
    await loginWithGoogle();
  } catch (e) {
    console.warn(e);
    showAlert("No se pudo iniciar sesión con Google.");
  }
});

$.logoutBtn?.addEventListener("click", async () => {
  await logout();
});

onAuthStateChanged(auth, (user) => {
  if (user?.email) {
    $.email.value = user.email;
    $.email.readOnly = true;
    $.logoutBtn?.classList.remove("d-none");
  } else {
    $.email.readOnly = false;
    $.logoutBtn?.classList.add("d-none");
  }
});

/* =========================
   Load config (booleans + textos)
   Firestore doc: club_config/public_registration
   {
     requireInfoDeclaration: true,
     infoDeclarationText: "...",
     requireTerms: true,
     termsUrl: "..."
   }
========================= */
async function loadPublicRegConfig() {
  const snap = await getDoc(CFG_DOC);
  const cfg = snap.exists() ? snap.data() : {};

  const requireInfoDeclaration = cfg.requireInfoDeclaration === true;
  const infoDeclarationText = cfg.infoDeclarationText || null;

  const requireTerms = cfg.requireTerms === true;
  const termsUrl = cfg.termsUrl || null;

  // Declaration
  if (requireInfoDeclaration) {
    $.declarationWrap.classList.remove("d-none");
    if (infoDeclarationText) $.infoDeclarationLabel.textContent = infoDeclarationText;
  } else {
    $.declarationWrap.classList.add("d-none");
    $.infoDeclaration.checked = false;
  }

  // Terms
  if (requireTerms) {
    $.termsWrap.classList.remove("d-none");
    $.termsLink.href = termsUrl || "#";
    $.termsLink.style.display = termsUrl ? "inline" : "none";
  } else {
    $.termsWrap.classList.add("d-none");
    $.termsAccepted.checked = false;
  }

  return { requireInfoDeclaration, requireTerms, termsUrl };
}

/* =========================
   Load payment plans
========================= */
let plansById = new Map();

async function loadPlans() {
  const qy = query(collection(db, COL_PLANS));
  const snap = await getDocs(qy);

  const plans = [];
  snap.forEach(d => plans.push({ id: d.id, ...d.data() }));

  const activePlans = plans.filter(p => p.isActive !== false);

  plansById = new Map(activePlans.map(p => [p.id, p]));

  $.planId.innerHTML =
    `<option value="">Seleccionar…</option>` +
    activePlans
      .map(p => {
        const label = `${p.name || "Plan"} — ${fmtMoney(p.amount, p.currency || "CRC")}`;
        return `<option value="${p.id}">${label}</option>`;
      })
      .join("");

  $.planMeta.textContent = "";
}

$.planId?.addEventListener("change", () => {
  const p = plansById.get($.planId.value);
  if (!p) {
    $.planMeta.textContent = "";
    return;
  }
  const parts = [];
  if (p.description) parts.push(p.description);
  if (p.amount != null) parts.push(`Monto: ${fmtMoney(p.amount, p.currency || "CRC")}`);
  $.planMeta.textContent = parts.join(" • ");
});

/* =========================
   Upsert associate + player
========================= */
async function upsertAssociateAndPlayer({ uid, email, profile }) {
  // buscamos asociado por uid (si existe), si no por email
  let assocId = null;

  // 1) por uid
  if (uid) {
    const q1 = query(collection(db, COL_ASSOC), where("uid", "==", uid), limit(1));
    const s1 = await getDocs(q1);
    s1.forEach(d => (assocId = d.id));
  }

  // 2) por email
  if (!assocId && email) {
    const q2 = query(collection(db, COL_ASSOC), where("email", "==", email), limit(1));
    const s2 = await getDocs(q2);
    s2.forEach(d => (assocId = d.id));
  }

  const assocPayload = {
    uid: uid || null,
    email: email || null,
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthDate: profile.birthDate,
    idType: profile.idType,
    idNumber: profile.idNumber,
    residence: profile.residence,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(), // si es update lo ignoramos (setDoc merge)
  };

  if (!assocId) {
    const newRef = await addDoc(collection(db, COL_ASSOC), assocPayload);
    assocId = newRef.id;
  } else {
    await setDoc(doc(db, COL_ASSOC, assocId), assocPayload, { merge: true });
  }

  // club_players: 1 jugador por asociado/uid
  let playerId = null;

  if (uid) {
    const qp = query(collection(db, COL_PLAYERS), where("uid", "==", uid), limit(1));
    const sp = await getDocs(qp);
    sp.forEach(d => (playerId = d.id));
  }

  if (!playerId && assocId) {
    const qp2 = query(collection(db, COL_PLAYERS), where("associateId", "==", assocId), limit(1));
    const sp2 = await getDocs(qp2);
    sp2.forEach(d => (playerId = d.id));
  }

  const playerPayload = {
    uid: uid || null,
    associateId: assocId,
    email: email || null,
    displayName: `${profile.firstName} ${profile.lastName}`.trim(),
    isActive: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  if (!playerId) {
    const newPlayer = await addDoc(collection(db, COL_PLAYERS), playerPayload);
    playerId = newPlayer.id;
  } else {
    await setDoc(doc(db, COL_PLAYERS, playerId), playerPayload, { merge: true });
  }

  return { assocId, playerId };
}

/* =========================
   Upload proof
========================= */
async function uploadProofFile({ uid, assocId, file }) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const safeExt = ext ? `.${ext}` : "";
  const path = `membership_submissions/${assocId || uid || "anonymous"}/${Date.now()}_proof${safeExt}`;

  const r = sRef(storage, path);
  const task = uploadBytesResumable(r, file, { contentType: file.type || "application/octet-stream" });

  await new Promise((resolve, reject) => {
    task.on("state_changed", null, reject, resolve);
  });

  const url = await getDownloadURL(task.snapshot.ref);
  return { filePath: path, fileUrl: url, fileType: file.type || null };
}

/* =========================
   Submit
========================= */
async function init() {
  setLoading(true);
  try {
    fillProvinceCanton();
    await loadPlans();
    await loadPublicRegConfig();
  } catch (e) {
    console.warn(e);
    showAlert("No se pudo cargar la configuración. Refresca la página.");
  } finally {
    setLoading(false);
    document.body.classList.remove("loading");
  }
}

init();

$.form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideAlert();

  const user = auth.currentUser;

  // Collect
  const profile = {
    firstName: norm($.firstName.value),
    lastName: norm($.lastName.value),
    birthDate: norm($.birthDate.value),
    idType: norm($.idType.value),
    idNumber: cleanIdNum($.idNumber.value),
    email: norm($.email.value).toLowerCase(),
    residence: {
      province: norm($.province.value),
      canton: norm($.canton.value),
    }
  };

  const planId = norm($.planId.value);
  const plan = plansById.get(planId);

  const file = $.proofFile.files?.[0] || null;

  // Load config again (to enforce server toggles)
  const cfg = await loadPublicRegConfig();

  // Validate
  if (!profile.firstName || !profile.lastName || !profile.birthDate || !profile.idType || !profile.idNumber || !profile.email) {
    showAlert("Completa todos los campos obligatorios.");
    return;
  }
  if (!profile.residence.province || !profile.residence.canton) {
    showAlert("Selecciona provincia y cantón.");
    return;
  }
  if (!planId || !plan) {
    showAlert("Selecciona un plan de pago válido.");
    return;
  }
  if (!file) {
    showAlert("Adjunta el comprobante de pago.");
    return;
  }
  if (cfg.requireInfoDeclaration && !$.infoDeclaration.checked) {
    showAlert("Debes aceptar la declaración de veracidad/uso de información.");
    return;
  }
  if (cfg.requireTerms && !$.termsAccepted.checked) {
    showAlert("Debes aceptar los términos y condiciones.");
    return;
  }

  setLoading(true);
  try {
    // Upsert associate + player (link)
    const uid = user?.uid || null;
    const { assocId, playerId } = await upsertAssociateAndPlayer({
      uid,
      email: profile.email,
      profile
    });

    // Upload proof
    const proof = await uploadProofFile({ uid, assocId, file });

    // Create membership (pending)
    const membershipRef = await addDoc(collection(db, COL_MEMBERSHIPS), {
      uid,
      associateId: assocId,
      playerId,
      email: profile.email,
      planId,
      planName: plan.name || null,
      currency: plan.currency || "CRC",
      amountDue: plan.amount ?? null,
      status: "pending",            // <-- para tabs de asociación / membresía
      source: "public_register",
      declarations: {
        infoDeclarationRequired: cfg.requireInfoDeclaration,
        infoDeclarationAccepted: cfg.requireInfoDeclaration ? true : null,
        termsRequired: cfg.requireTerms,
        termsAccepted: cfg.requireTerms ? true : null,
        termsUrl: cfg.termsUrl || null,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create payment submission (pending review)
    await addDoc(collection(db, COL_SUBMISSIONS), {
      uid,
      associateId: assocId,
      playerId,
      membershipId: membershipRef.id,
      planId,
      amountReported: plan.amount ?? null,
      currency: plan.currency || "CRC",
      email: profile.email,

      filePath: proof.filePath,
      fileUrl: proof.fileUrl,
      fileType: proof.fileType,

      adminNote: null,
      status: "pending",            // <-- para tab pago-miembro
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    showAlert("¡Listo! Recibimos tu registro. Queda en revisión.", "success");
    $.form.reset();

    // si está logueado por Google, dejamos email readonly de nuevo
    if (auth.currentUser?.email) {
      $.email.value = auth.currentUser.email;
      $.email.readOnly = true;
    }

  } catch (e) {
    console.warn(e);
    showAlert("Ocurrió un error al enviar. Revisa tu conexión e intenta de nuevo.");
  } finally {
    setLoading(false);
  }
});
