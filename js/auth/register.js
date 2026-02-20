// js/public/register.js
import { db, auth, storage } from "../auth/firebase.js";
import { loginWithGoogle, logout } from "../auth/auth.js";
import { loadHeader } from "../components/header.js";
import { APP_CONFIG } from "../config/config.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* =========================
   Config / Collections
========================= */
const CLUB_ID = APP_CONFIG?.clubId || APP_CONFIG?.club?.id || "volcanes";

const COL_PLANS = "subscription_plans"; // (tus planes actuales)
const COL_ASSOC = "associates";
const COL_PLAYERS = "club_players";
const COL_MEMBERSHIPS = "memberships";
const COL_INSTALLMENTS = "membership_installments";
const COL_SUBMISSIONS = "membership_payment_submissions";

// Config doc
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

  phone: document.getElementById("phone"),
  payerName: document.getElementById("payerName"),
  payMethod: document.getElementById("payMethod"),

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

function normLower(s) {
  return norm(s).toLowerCase();
}

function fmtMoney(n, cur = "CRC") {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: cur }).format(v);
}

function makePayCode(len = 6) {
  // parecido a lo que ya usas (QEQHH5X)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function safeSeasonFromToday() {
  // simple: usa año actual local del navegador
  return String(new Date().getFullYear());
}

/* =========================
   Role / Access helpers
========================= */
async function hasActiveRole(uid) {
  const roleRef = doc(db, "user_roles", uid);
  const snap = await getDoc(roleRef);
  if (!snap.exists()) return false;
  const r = snap.data();
  return r?.active === true && r?.clubId === CLUB_ID;
}

async function ensureRole(uid) {
  const roleRef = doc(db, "user_roles", uid);
  const snap = await getDoc(roleRef);
  if (snap.exists()) return;

  await setDoc(
    roleRef,
    {
      clubId: CLUB_ID,
      role: "viewer",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* =========================
   Costa Rica: Provincia/Cantón (mínimo viable)
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

  if ($.province) {
    $.province.innerHTML =
      `<option value="">Seleccionar…</option>` +
      provinces.map((p) => `<option value="${p}">${p}</option>`).join("");
  }

  if ($.canton) $.canton.innerHTML = `<option value="">Seleccionar…</option>`;

  $.province?.addEventListener("change", () => {
    const p = $.province.value;
    const cantons = CR[p] || [];
    if ($.canton) {
      $.canton.innerHTML =
        `<option value="">Seleccionar…</option>` +
        cantons.map((c) => `<option value="${c}">${c}</option>`).join("");
    }
  });
}

/* =========================
   Header: sin tabs aquí (evita flash)
========================= */
loadHeader("home", { enabledTabs: {} });

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
    const u = await loginWithGoogle();

    // Si ya tiene rol activo, no debería estar registrándose aquí:
    if (u?.uid && (await hasActiveRole(u.uid))) {
      window.location.replace("../dashboard.html");
      return;
    }
  } catch (e) {
    console.warn(e);
    showAlert("No se pudo iniciar sesión con Google.");
  }
});

$.logoutBtn?.addEventListener("click", async () => {
  await logout();
});

onAuthStateChanged(auth, async (user) => {
  if (user?.uid && (await hasActiveRole(user.uid))) {
    window.location.replace("../dashboard.html");
    return;
  }

  if (user?.email && $.email) {
    $.email.value = user.email;
    $.email.readOnly = true;
    $.logoutBtn?.classList.remove("d-none");
  } else {
    if ($.email) $.email.readOnly = false;
    $.logoutBtn?.classList.add("d-none");
  }
});

/* =========================
   Config (booleans + textos)
========================= */
async function loadPublicRegConfig() {
  const snap = await getDoc(CFG_DOC);
  const cfg = snap.exists() ? snap.data() : {};

  const requireInfoDeclaration = cfg.requireInfoDeclaration === true;
  const infoDeclarationText = cfg.infoDeclarationText || null;

  const requireTerms = cfg.requireTerms === true;
  const termsUrl = cfg.termsUrl || null;

  if ($.declarationWrap && $.infoDeclaration && $.infoDeclarationLabel) {
    if (requireInfoDeclaration) {
      $.declarationWrap.classList.remove("d-none");
      if (infoDeclarationText) $.infoDeclarationLabel.textContent = infoDeclarationText;
    } else {
      $.declarationWrap.classList.add("d-none");
      $.infoDeclaration.checked = false;
    }
  }

  if ($.termsWrap && $.termsAccepted && $.termsLink) {
    if (requireTerms) {
      $.termsWrap.classList.remove("d-none");
      $.termsLink.href = termsUrl || "#";
      $.termsLink.style.display = termsUrl ? "inline" : "none";
    } else {
      $.termsWrap.classList.add("d-none");
      $.termsAccepted.checked = false;
    }
  }

  return { requireInfoDeclaration, requireTerms, termsUrl };
}

/* =========================
   Plans
========================= */
let plansById = new Map();

function planAmount(plan) {
  // soporta ambos: amount o totalAmount
  const a = plan?.totalAmount ?? plan?.amount ?? null;
  return a === null || a === undefined ? null : Number(a);
}

async function loadPlans() {
  const qy = query(collection(db, COL_PLANS));
  const snap = await getDocs(qy);

  const plans = [];
  snap.forEach((d) => plans.push({ id: d.id, ...d.data() }));

  const activePlans = plans.filter((p) => p.isActive !== false);

  plansById = new Map(activePlans.map((p) => [p.id, p]));

  if ($.planId) {
    $.planId.innerHTML =
      `<option value="">Seleccionar…</option>` +
      activePlans
        .map((p) => {
          const amt = planAmount(p);
          const label = `${p.name || "Plan"} — ${fmtMoney(amt, p.currency || "CRC")}`;
          return `<option value="${p.id}">${label}</option>`;
        })
        .join("");
  }

  if ($.planMeta) $.planMeta.textContent = "";
}

$.planId?.addEventListener("change", () => {
  const p = plansById.get($.planId.value);
  if (!p) {
    if ($.planMeta) $.planMeta.textContent = "";
    return;
  }
  const parts = [];
  if (p.description) parts.push(p.description);
  const amt = planAmount(p);
  if (amt != null) parts.push(`Monto: ${fmtMoney(amt, p.currency || "CRC")}`);
  if ($.planMeta) $.planMeta.textContent = parts.join(" • ");
});

/* =========================
   Identity linking (Associate <-> Player <-> UserRoles)
========================= */

// 2) upsert associate by uid or email
async function upsertAssociate({
  uid,
  email,
  firstName,
  lastName,
  birthDate,
  idType,
  idNumber,
  phone,
  residence,
  consents,
}) {
  const fullName = `${firstName} ${lastName}`.trim();

  let assocId = null;

  // a) match by uid (más fuerte)
  if (uid) {
    const qUid = query(collection(db, COL_ASSOC), where("uid", "==", uid), limit(1));
    const sUid = await getDocs(qUid);
    sUid.forEach((d) => (assocId = d.id));
  }

  // b) match by email
  if (!assocId && email) {
    const qEmail = query(collection(db, COL_ASSOC), where("email", "==", email), limit(1));
    const sEmail = await getDocs(qEmail);
    sEmail.forEach((d) => (assocId = d.id));
  }

  const payload = {
    active: true,
    email: email || null,
    fullName: fullName || null,
    phone: phone || null,
    type: idType || "other",
    idNumber: idNumber || null,

    uid: uid || null,
    // nuevo: puntero directo (si linkeamos player)
    playerId: null,

    profile: {
      firstName: firstName || null,
      lastName: lastName || null,
      birthDate: birthDate || null,
      idType: idType || null,
      idNumber: idNumber || null,
      residence: residence || null,
    },

    consents: consents || null,

    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  if (!assocId) {
    const ref = await addDoc(collection(db, COL_ASSOC), payload);
    assocId = ref.id;
  } else {
    await setDoc(doc(db, COL_ASSOC, assocId), payload, { merge: true });
  }

  const associateSnapshot = {
    id: assocId,
    fullName,
    email,
    phone: phone || null,
  };

  return { assocId, associateSnapshot };
}

// 3) try link to existing club_player (email/uid/name+birthday). If ambiguous, do nothing.
async function findPlayerToLink({ uid, email, firstName, lastName, birthDate }) {
  // by uid
  if (uid) {
    const q1 = query(collection(db, COL_PLAYERS), where("uid", "==", uid), limit(1));
    const s1 = await getDocs(q1);
    let found = null;
    s1.forEach((d) => (found = { id: d.id, ...d.data() }));
    if (found) return found;
  }

  // by email
  if (email) {
    const q2 = query(collection(db, COL_PLAYERS), where("email", "==", email), limit(1));
    const s2 = await getDocs(q2);
    let found = null;
    s2.forEach((d) => (found = { id: d.id, ...d.data() }));
    if (found) return found;
  }

  // by name + birthday (unique) — sin índice compuesto:
  if (firstName && lastName && birthDate) {
    const qb = query(collection(db, COL_PLAYERS), where("birthday", "==", birthDate), limit(25));
    const sb = await getDocs(qb);

    const fn = firstName.trim().toLowerCase();
    const ln = lastName.trim().toLowerCase();

    const matches = [];
    sb.forEach((d) => {
      const p = d.data() || {};
      const pfn = (p.firstName || "").toString().trim().toLowerCase();
      const pln = (p.lastName || "").toString().trim().toLowerCase();
      if (pfn === fn && pln === ln) matches.push({ id: d.id, ...p });
    });

    if (matches.length === 1) return matches[0];
  }

  return null;
}

// 4) upsert player: if found, link. if not found, create minimal player and link.
async function ensureLinkedPlayer({ assocId, uid, email, firstName, lastName, birthDate }) {
  let player = await findPlayerToLink({ uid, email, firstName, lastName, birthDate });

  const payload = {
    active: true,
    firstName: firstName || null,
    lastName: lastName || null,
    birthday: birthDate || null,

    // nuevos links
    associateId: assocId,
    uid: uid || null,
    email: email || null,

    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  if (!player) {
    const ref = await addDoc(collection(db, COL_PLAYERS), payload);
    return { playerId: ref.id, created: true };
  }

  await setDoc(doc(db, COL_PLAYERS, player.id), payload, { merge: true });
  return { playerId: player.id, created: false };
}

/* =========================
   Membership builders (align to your schema)
========================= */
function buildPlanSnapshot(plan) {
  return {
    id: plan.id,
    name: plan.name || null,
    currency: plan.currency || "CRC",
    totalAmount: planAmount(plan),
    durationMonths: plan.durationMonths ?? 12,
    requiresValidation: plan.requiresValidation !== false,
    startPolicy: plan.startPolicy || "jan",
    allowPartial: !!plan.allowPartial,
    allowCustomAmount: !!plan.allowCustomAmount,
    benefits: plan.benefits || [],
    tags: plan.tags || [],
  };
}

async function createMembership({ assocId, associateSnapshot, plan, season, consents }) {
  const payCode = makePayCode(7);
  const planSnap = buildPlanSnapshot(plan);

  const payload = {
    associateId: assocId,
    associateSnapshot,

    planId: plan.id,
    planSnapshot: planSnap,

    currency: planSnap.currency,
    totalAmount: planSnap.totalAmount,
    season: season,

    status: "pending",

    payCode,
    payLinkEnabled: false,
    payLinkDisabledReason: "Pendiente de validación.",

    installmentsTotal: 0,
    installmentsPending: 0,
    installmentsSettled: 0,
    nextUnpaidDueDate: null,
    nextUnpaidN: null,

    consents: consents || null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COL_MEMBERSHIPS), payload);
  return { membershipId: ref.id, payCode };
}

// si plan.installmentsCount > 1 => crea cuotas iguales y devuelve ids
async function maybeCreateInstallments({ membershipId, plan, season }) {
  const count = Number(plan.installmentsCount || 0);
  if (!count || count < 2) return { installmentIds: [] };

  const total = planAmount(plan) || 0;
  const amount = Math.round((total / count) * 100) / 100;

  const dueDay = Number(plan.dueDay || 10);
  const startMonth = plan.startPolicy === "jan" ? 1 : Number(plan.startMonth || 1);

  const nowYear = Number(season);
  const ids = [];

  for (let i = 0; i < count; i++) {
    const m = startMonth + i;
    const mm = ((m - 1) % 12) + 1;
    const yy = nowYear + Math.floor((m - 1) / 12);

    const dueDate = `${yy}-${String(mm).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
    const dueMonthDay = dueDate.slice(5);

    const instRef = await addDoc(collection(db, COL_INSTALLMENTS), {
      amount,
      dueDate,
      dueMonthDay,
      membershipId,
      n: i + 1,
      planId: plan.id,
      season,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    ids.push(instRef.id);
  }

  await updateDoc(doc(db, COL_MEMBERSHIPS, membershipId), {
    installmentsTotal: count,
    installmentsPending: count,
    installmentsSettled: 0,
    nextUnpaidDueDate: ids.length
      ? `${nowYear}-${String(startMonth).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`
      : null,
    nextUnpaidN: ids.length ? 1 : null,
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  return { installmentIds: ids };
}

/* =========================
   Upload proof
========================= */
async function uploadProofFile({ uid, assocId, file }) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const safeExt = ext ? `.${ext}` : "";
  const path = `membership_submissions/${assocId || uid || "anonymous"}/${Date.now()}_proof${safeExt}`;

  const r = sRef(storage, path);
  const task = uploadBytesResumable(r, file, {
    contentType: file.type || "application/octet-stream",
  });

  await new Promise((resolve, reject) => {
    task.on("state_changed", null, reject, resolve);
  });

  const url = await getDownloadURL(task.snapshot.ref);
  return { filePath: path, fileUrl: url, fileType: file.type || null };
}

/* =========================
   Fill info from Google (prefill)
========================= */
function applyPrefillFromSession() {
  try {
    const raw = sessionStorage.getItem("prefill_register");
    if (!raw) return;
    const p = JSON.parse(raw);

    if ($.email && p.email) {
      $.email.value = p.email;
      $.email.readOnly = true;
    }

    if ($.firstName && $.lastName && p.fullName) {
      const parts = String(p.fullName).trim().split(/\s+/);
      if (!$.firstName.value) $.firstName.value = parts.shift() || "";
      if (!$.lastName.value) $.lastName.value = parts.join(" ");
    }

    if ($.phone && p.phone && !$.phone.value) {
      $.phone.value = p.phone;
    }
  } catch (e) {
    console.warn("prefill_register invalid", e);
  }
}

applyPrefillFromSession();

/* =========================
   Init
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

/* =========================
   Debug helpers
========================= */
function firebaseErrMsg(e) {
  const code = e?.code ? String(e.code) : "";
  if (code.includes("permission-denied")) return "Permisos insuficientes (rules).";
  if (code.includes("unauthenticated")) return "No hay sesión (login) activa.";
  if (code.includes("failed-precondition")) return "Falta un índice o precondición en Firestore.";
  return e?.message ? e.message : "Error desconocido.";
}

async function step(name, fn) {
  try {
    const r = await fn();
    console.log(`✅ ${name}`);
    return r;
  } catch (e) {
    console.error(`❌ ${name}`, e);
    throw new Error(`${name}: ${firebaseErrMsg(e)}`);
  }
}

/* =========================
   Submit
========================= */
$.form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideAlert();

  const user = auth.currentUser;

  // registro público requiere estar logueado
  if (!user?.uid) {
    showAlert("Primero ingresa con Google para completar el registro.");
    return;
  }

  const uid = user.uid;

  // Data
  const firstName = norm($.firstName?.value);
  const lastName = norm($.lastName?.value);
  const birthDate = norm($.birthDate?.value);

  const idType = normLower($.idType?.value);
  const idNumber = cleanIdNum($.idNumber?.value);

  const email = user.email ? String(user.email).toLowerCase() : normLower($.email?.value);
  const phone = norm($.phone?.value);

  const residence = {
    province: norm($.province?.value),
    canton: norm($.canton?.value),
  };

  const planId = norm($.planId?.value);
  const plan = plansById.get(planId);

  const file = $.proofFile?.files?.[0] || null;

  const payerName = norm($.payerName?.value) || `${firstName} ${lastName}`.trim();
  const method = normLower($.payMethod?.value) || "sinpe";

  // enforce config
  const cfg = await loadPublicRegConfig();

  // Validate basics
  if (!firstName || !lastName || !birthDate || !idType || !idNumber || !email) {
    showAlert("Completa todos los campos obligatorios.");
    return;
  }
  if (!residence.province || !residence.canton) {
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
  if (cfg.requireInfoDeclaration && !$.infoDeclaration?.checked) {
    showAlert("Debes aceptar la declaración de veracidad/uso de información.");
    return;
  }
  if (cfg.requireTerms && !$.termsAccepted?.checked) {
    showAlert("Debes aceptar los términos y condiciones.");
    return;
  }

  const consents = {
    requireInfoDeclaration: !!cfg.requireInfoDeclaration,
    infoDeclarationAccepted: cfg.requireInfoDeclaration ? true : null,
    requireTerms: !!cfg.requireTerms,
    termsAccepted: cfg.requireTerms ? true : null,
    termsUrl: cfg.termsUrl || null,
    acceptedAt: serverTimestamp(),
  };

  setLoading(true);
  try {
    // 0) sanity: uid siempre
    if (!uid) throw new Error("No hay uid (login incompleto).");

    const { assocId, associateSnapshot } = await step("Upsert associate", () =>
      upsertAssociate({
        uid,
        email,
        firstName,
        lastName,
        birthDate,
        idType,
        idNumber,
        phone,
        residence,
        consents,
      })
    );

    const { playerId } = await step("Link/create club_player", () =>
      ensureLinkedPlayer({ assocId, uid, email, firstName, lastName, birthDate })
    );

    await step("Update associate.playerId", () =>
      setDoc(
        doc(db, COL_ASSOC, assocId),
        { playerId: playerId || null, updatedAt: serverTimestamp() },
        { merge: true }
      )
    );

    const proof = await step("Upload proof (Storage)", () =>
      uploadProofFile({ uid, assocId, file })
    );

    const season = plan.season || safeSeasonFromToday();

    const { membershipId } = await step("Create membership", () =>
      createMembership({
        assocId,
        associateSnapshot,
        plan: { id: planId, ...plan },
        season,
        consents,
      })
    );

    // opcional: si querés crear installments según plan:
    await step("Maybe create installments", () =>
      maybeCreateInstallments({ membershipId, plan: { id: planId, ...plan }, season })
    );

    await step("Create payment submission", () =>
      addDoc(collection(db, COL_SUBMISSIONS), {
        adminNote: null,
        note: null,

        amountReported: planAmount(plan),
        currency: plan.currency || "CRC",

        email,
        payerName: payerName || null,
        phone: phone || null,
        method: method || "sinpe",

        filePath: proof.filePath,
        fileType: proof.fileType,
        fileUrl: proof.fileUrl,

        installmentId: null,
        selectedInstallmentIds: [],

        membershipId,
        planId,
        season,

        status: "pending",
        userId: uid,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    await step("Mark onboarding complete (users/{uid})", async () => {
      const uref = doc(db, "users", uid);
      const usnap = await getDoc(uref);

      const payload = {
        clubId: CLUB_ID,
        email: email || auth.currentUser?.email || null,
        onboardingComplete: true,
        profileStatus: "complete",
        associateId: assocId,
        playerId: playerId || null,
        updatedAt: serverTimestamp(),
      };

      if (!usnap.exists()) payload.createdAt = serverTimestamp();

      return setDoc(uref, payload, { merge: true });
    });

    await step("Ensure access role (user_roles/{uid})", () => ensureRole(uid));

    // limpieza opcional
    sessionStorage.removeItem("prefill_register");

    // dashboard (desde /public/)
    window.location.replace("../dashboard.html");
    return;
  } catch (e) {
    console.warn(e);
    showAlert(String(e.message || e), "danger");
  } finally {
    setLoading(false);
  }
});