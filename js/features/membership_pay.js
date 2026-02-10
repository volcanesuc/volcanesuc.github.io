import { db } from "../firebase.js";

import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage,
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================
   Collections
========================= */
const COL_MEMBERSHIPS = "memberships";
const COL_INSTALLMENTS = "membership_installments";
const COL_SUBMISSIONS = "membership_payment_submissions";

/* =========================
   DOM
========================= */
const pagePill = document.getElementById("pagePill");
const alertBox = document.getElementById("alertBox");

const assocName = document.getElementById("assocName");
const assocContact = document.getElementById("assocContact");
const planName = document.getElementById("planName");
const planMeta = document.getElementById("planMeta");

const payDisabledCard = document.getElementById("payDisabledCard");
const payDisabledMsg = document.getElementById("payDisabledMsg");

const payForm = document.getElementById("payForm");
const installmentSelect = document.getElementById("installmentSelect");
const installmentHint = document.getElementById("installmentHint");

const payerName = document.getElementById("payerName");
const amount = document.getElementById("amount");
const amountHint = document.getElementById("amountHint");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const method = document.getElementById("method");
const fileInput = document.getElementById("file");
const note = document.getElementById("note");

const btnSubmit = document.getElementById("btnSubmit");
const btnReset = document.getElementById("btnReset");

const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const midText = document.getElementById("midText");

/* =========================
   Params
========================= */
const params = new URLSearchParams(window.location.search);
const mid = params.get("mid");
const code = params.get("code");

/* =========================
   State
========================= */
let membership = null;
let installments = [];

/* =========================
   Helpers
========================= */
function showAlert(msg, type = "warning"){
  if (!alertBox) return alert(msg);
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove("d-none");
}

function hideAlert(){
  alertBox?.classList.add("d-none");
}

function disableForm(disabled = true){
  if (!payForm) return;
  if (disabled) payForm.classList.add("disabled-overlay");
  else payForm.classList.remove("disabled-overlay");
}

function fmtMoney(n, cur="CRC"){
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", { style:"currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function safe(s){ return (s || "").toString().trim(); }

function setProgress(pct, text){
  progressWrap?.classList.remove("d-none");
  progressText?.classList.remove("d-none");
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressText) progressText.textContent = text || "";
}

function clearProgress(){
  progressWrap?.classList.add("d-none");
  progressText?.classList.add("d-none");
  if (progressBar) progressBar.style.width = "0%";
  if (progressText) progressText.textContent = "";
}

function inferCurrency(){
  return membership?.currency || membership?.planSnapshot?.currency || "CRC";
}

function getInstallmentById(id){
  return installments.find(x => x.id === id) || null;
}

function setPayDisabledUI(msg){
  // show card + hide form
  payForm?.classList.add("d-none");
  payDisabledCard?.classList.remove("d-none");
  if (payDisabledMsg) payDisabledMsg.textContent = msg || "";

  btnSubmit && (btnSubmit.disabled = true);
  disableForm(true);

  if (pagePill) pagePill.textContent = "En revisión";
}

/* =========================
   Boot
========================= */
(async function boot(){
  if (midText) midText.textContent = mid || "—";

  if (!mid || !code){
    if (pagePill) pagePill.textContent = "Link inválido";
    disableForm(true);
    showAlert("Link inválido. Asegurate de abrir el enlace completo (mid y code).", "danger");
    return;
  }

  if (pagePill) pagePill.textContent = "Cargando…";
  disableForm(true);

  // Anonymous auth (sin login)
  try{
    const auth = getAuth();
    await signInAnonymously(auth);
  }catch(e){
    console.warn("Anonymous auth no disponible:", e);
  }

  try{
    await loadMembership();
    await loadInstallments();

    // Gate: si está bloqueado, mostramos card y salimos sin inicializar submit
    if (membership?.payLinkEnabled === false){
      fillSummaryOnly(); // llena asociado/plan arriba
      const reason =
        membership?.payLinkDisabledReason ||
        "Este link está deshabilitado mientras el admin revisa el comprobante.";
      setPayDisabledUI(reason);
      showAlert(reason, "warning");
      return;
    }

    fillUI();
    disableForm(false);
    if (pagePill) pagePill.textContent = "Listo";

  }catch(e){
    console.error(e);
    if (pagePill) pagePill.textContent = "No disponible";
    disableForm(true);

    if (String(e?.message || e).includes("invalid_code")){
      showAlert("Código inválido.", "danger");
    } else {
      showAlert("No se pudo cargar la membresía. Revisá el link o contactá al club.", "danger");
    }
  }
})();

/* =========================
   Load data
========================= */
async function loadMembership(){
  const snap = await getDoc(doc(db, COL_MEMBERSHIPS, mid));
  if (!snap.exists()) throw new Error("membership_not_found");

  membership = { id: snap.id, ...snap.data() };

  // Validar code
  if ((membership.payCode || "") !== code){
    throw new Error("invalid_code");
  }
}

async function loadInstallments(){
  // sin orderBy para evitar índices; ordenamos client-side
  const q = query(collection(db, COL_INSTALLMENTS), where("membershipId", "==", mid));
  const snap = await getDocs(q);

  installments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.n||0)-(b.n||0));
}

/* =========================
   UI fill
========================= */
function fillSummaryOnly(){
  hideAlert();

  const a = membership?.associateSnapshot || {};
  const p = membership?.planSnapshot || {};
  const cur = inferCurrency();

  assocName && (assocName.textContent = a.fullName || "—");
  assocContact && (assocContact.textContent = [a.email || null, a.phone || null].filter(Boolean).join(" • ") || "—");

  planName && (planName.textContent = p.name || "—");
  const totalTxt = p.allowCustomAmount ? "Monto editable" : fmtMoney(membership.totalAmount ?? p.totalAmount, cur);
  planMeta && (planMeta.textContent = `${totalTxt} • ${p.allowPartial ? "Permite cuotas" : "Pago único"} • ${p.requiresValidation ? "Validación admin" : "Sin validación"}`);
}

function fillUI(){
  fillSummaryOnly();

  // defaults
  const a = membership.associateSnapshot || {};
  payerName && (payerName.value = a.fullName || "");
  email && (email.value = a.email || "");
  phone && (phone.value = a.phone || "");

  // installments select
  const cur = inferCurrency();
  const pending = installments.filter(x => (x.status || "pending") !== "validated");
  const options = pending.map(x => {
    const due = x.dueDate || (x.dueMonthDay ? `${membership.season}-${x.dueMonthDay}` : "—");
    const label = `Cuota #${x.n} • vence ${due} • ${fmtMoney(x.amount, cur)} • ${x.status || "pending"}`;
    return `<option value="${x.id}">${label}</option>`;
  }).join("");

  installmentSelect.innerHTML =
    `<option value="">Pago general (sin cuota específica)</option>` +
    (options || "");

  installmentHint.textContent = pending.length
    ? "Podés elegir una cuota pendiente o dejarlo como pago general."
    : "No hay cuotas pendientes (o este plan es pago único). Podés enviar pago general si aplica.";

  // amount hint
  const p = membership.planSnapshot || {};
  amountHint.textContent = p.allowCustomAmount
    ? "Este plan permite monto editable. Escribí el monto que pagaste."
    : "Escribí el monto exacto del pago (si es una cuota, suele ser el monto de la cuota).";

  // si selecciona cuota, sugerimos monto
  // (evitar duplicar listener si fillUI corre más de una vez)
  installmentSelect.onchange = () => {
    const iid = installmentSelect.value || "";
    if (!iid) return;
    const it = getInstallmentById(iid);
    if (it && it.amount !== undefined && it.amount !== null && amount.value === ""){
      amount.value = String(it.amount);
    }
  };

  // reset (guard: si está bloqueado, no hace nada)
  btnReset.onclick = () => {
    if (membership?.payLinkEnabled === false) return;
    installmentSelect.value = "";
    amount.value = "";
    method.value = "sinpe";
    fileInput.value = "";
    note.value = "";
    clearProgress();
    hideAlert();
  };

  // submit (evitar duplicar listener)
  payForm.onsubmit = onSubmit;
}

/* =========================
   Submit
========================= */
async function onSubmit(e){
  e.preventDefault();
  hideAlert();

  // gate extra (por si cambió en backend mientras la página está abierta)
  if (membership?.payLinkEnabled === false){
    const reason =
      membership?.payLinkDisabledReason ||
      "Este link está deshabilitado mientras el admin revisa el comprobante.";
    setPayDisabledUI(reason);
    showAlert(reason, "warning");
    return;
  }

  const cur = inferCurrency();
  const p = membership.planSnapshot || {};

  const payer = safe(payerName.value);
  if (!payer) return showAlert("Falta el nombre.", "warning");

  const amt = Number(amount.value);
  if (!amount.value || Number.isNaN(amt) || amt <= 0){
    return showAlert("Monto inválido.", "warning");
  }

  const f = fileInput.files?.[0];
  if (!f) return showAlert("Adjuntá un comprobante (imagen o PDF).", "warning");

  // tipo permitido
  const okType = f.type.startsWith("image/") || f.type === "application/pdf";
  if (!okType) return showAlert("Tipo de archivo no permitido. Usá imagen o PDF.", "warning");

  // tamaño
  const MAX_MB = 10;
  if (f.size > MAX_MB * 1024 * 1024){
    return showAlert(`Archivo muy grande. Máximo ${MAX_MB}MB.`, "warning");
  }

  btnSubmit.disabled = true;
  disableForm(true);
  clearProgress();
  setProgress(5, "Preparando subida…");

  let sid = null;
  let path = null;

  try{
    // 1) Crear submission primero (para usar sid en storage path)
    const iid = installmentSelect.value || null;

    const submissionDoc = await addDoc(collection(db, COL_SUBMISSIONS), {
      membershipId: mid,
      installmentId: iid,

      season: membership.season || null,
      planId: membership.planId || (p.id || null),

      payerName: payer,
      email: safe(email.value) || null,
      phone: safe(phone.value) || null,
      amountReported: amt,
      currency: cur,

      method: method.value || "other",
      note: safe(note.value) || null,

      status: "pending",
      adminNote: null,

      fileUrl: null,
      filePath: null,
      fileType: f.type || null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    sid = submissionDoc.id;

    // 2) Subir a Storage
    const storage = getStorage();
    const safeName = (f.name || "comprobante").replace(/[^\w.\-()]+/g, "_");
    path = `membership_submissions/${mid}/${sid}/${Date.now()}_${safeName}`;
    const fileRef = sRef(storage, path);

    const task = uploadBytesResumable(fileRef, f, { contentType: f.type || undefined });

    await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setProgress(Math.max(10, Math.min(90, pct)), `Subiendo… ${pct}%`);
        },
        (err) => reject(err),
        () => resolve()
      );
    });

    setProgress(92, "Finalizando…");

    const url = await getDownloadURL(fileRef);

    // 3) Guardar fileUrl + filePath en submission
    await setDoc(doc(db, COL_SUBMISSIONS, sid), {
      fileUrl: url,
      filePath: path,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 4) (best-effort) Bloquear link mientras revisa admin
    // ⚠️ Si Firestore rules no permiten, lo ignoramos.
    try{
      await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
        payLinkEnabled: false,
        payLinkDisabledReason: "Comprobante enviado. En revisión por el admin.",
        updatedAt: serverTimestamp()
      });

      // actualizar estado local + UI sin recargar
      membership.payLinkEnabled = false;
      membership.payLinkDisabledReason = "Comprobante enviado. En revisión por el admin.";

      setProgress(100, "✅ Enviado");
      showAlert("✅ Comprobante enviado. Un admin lo revisará pronto.", "success");

      // mostrar card y ocultar form
      setPayDisabledUI(membership.payLinkDisabledReason);

      return; // salimos; ya no dejamos seguir

    }catch (e){
      console.warn("No se pudo bloquear el link automáticamente (rules).", e?.code || e);
    }

    setProgress(100, "✅ Enviado");
    showAlert("✅ Comprobante enviado. Un admin lo revisará pronto.", "success");

    // limpiar campos de pago (dejamos contacto)
    installmentSelect.value = "";
    amount.value = "";
    fileInput.value = "";
    note.value = "";

  } catch (err){
    console.error(err);

    const code = err?.code || "";
    const msg =
      code === "storage/unauthorized"
        ? "❌ No tenés permiso para subir el archivo. (Revisá Storage Rules y Auth anónimo)."
      : code === "storage/retry-limit-exceeded"
        ? "❌ Falló la subida (reintentos agotados). Probá con otra red o un archivo más liviano."
      : code === "storage/canceled"
        ? "❌ Subida cancelada."
      : code === "storage/invalid-checksum"
        ? "❌ El archivo se corrompió al subir. Intentá otra vez."
      : "❌ Ocurrió un error subiendo el comprobante. Intentá de nuevo o contactá al club.";

    showAlert(msg, "danger");
    clearProgress();

    // (opcional) marcar submission como error si ya existe sid
    if (sid){
      try{
        await setDoc(doc(db, COL_SUBMISSIONS, sid), {
          status: "error",
          adminNote: `Upload error: ${code || (err?.message || "unknown")}`,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }catch (e){
        console.warn("No se pudo marcar submission como error:", e);
      }
    }

  } finally {
    // si quedó bloqueado, mantenemos disabled
    if (membership?.payLinkEnabled === false){
      btnSubmit.disabled = true;
      disableForm(true);
    } else {
      btnSubmit.disabled = false;
      disableForm(false);
    }
  }
}
