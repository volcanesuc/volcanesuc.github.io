import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { loadHeader } from "../components/header.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

loadHeader("admin");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

/* =========================
   Collections
========================= */
const COL_MEMBERSHIPS = "memberships";
const COL_INSTALLMENTS = "membership_installments";
const COL_SUBMISSIONS = "membership_payment_submissions";

/* =========================
   Params
========================= */
const params = new URLSearchParams(window.location.search);
const mid = params.get("mid");

/* =========================
   DOM
========================= */
const alertBox = document.getElementById("alertBox");

const assocName = document.getElementById("assocName");
const assocContact = document.getElementById("assocContact");
const planName = document.getElementById("planName");
const planMeta = document.getElementById("planMeta");

const midText = document.getElementById("midText");
const seasonText = document.getElementById("seasonText");
const statusBadge = document.getElementById("statusBadge");

const btnRefresh = document.getElementById("btnRefresh");
const btnCopyPayLink = document.getElementById("btnCopyPayLink");
const btnOpenPayLink = document.getElementById("btnOpenPayLink");

const installmentsCount = document.getElementById("installmentsCount");
const installmentsTbody = document.getElementById("installmentsTbody");

const subsCount = document.getElementById("subsCount");
const subsTbody = document.getElementById("subsTbody");

const rejectModalEl = document.getElementById("rejectModal");
const rejectModal = new bootstrap.Modal(rejectModalEl);
const rejectNote = document.getElementById("rejectNote");
const rejectSid = document.getElementById("rejectSid");
const btnConfirmReject = document.getElementById("btnConfirmReject");

/* =========================
   State
========================= */
let membership = null;
let installments = [];
let submissions = [];

/* =========================
   Helpers
========================= */
function showAlert(msg, type="warning"){
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove("d-none");
}
function hideAlert(){ alertBox.classList.add("d-none"); }

function fmtMoney(n, cur="CRC"){
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", { style:"currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function badge(text, cls=""){
  return `<span class="badge-soft ${cls}">${text}</span>`;
}

function statusBadgeHtml(st){
  const s = (st || "pending").toLowerCase();
  if (s === "validated") return badge("Validado", "green");
  if (s === "paid") return badge("Pagado", "yellow");
  if (s === "partial") return badge("Parcial", "yellow");
  if (s === "rejected") return badge("Rechazado", "red");
  if (s === "inactive") return badge("Inactivo", "gray");
  return badge("Pendiente", "gray");
}

function toDateText(ts){
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function payUrl(mid, code){
  const base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]+$/, "/")}`;
  return `${base}membership_pay.html?mid=${encodeURIComponent(mid)}&code=${encodeURIComponent(code)}`;
}

function getCurrency(){
  return membership?.currency || membership?.planSnapshot?.currency || "CRC";
}

function getInstallmentById(id){
  return installments.find(x => x.id === id) || null;
}

function computeMembershipStatus(){
  // If requiresValidation -> "validated" only when all installments validated (or if no installments: latest submission validated)
  const p = membership?.planSnapshot || {};
  const requiresValidation = !!p.requiresValidation;

  if (installments.length){
    const statuses = installments.map(i => (i.status || "pending").toLowerCase());
    const allValidated = statuses.every(s => s === "validated");
    const allPaidOrValidated = statuses.every(s => s === "paid" || s === "validated");
    const anyPaidOrValidated = statuses.some(s => s === "paid" || s === "validated");

    if (requiresValidation){
      if (allValidated) return "validated";
      if (anyPaidOrValidated) return "partial";
      return "pending";
    } else {
      if (allPaidOrValidated) return "paid";
      if (anyPaidOrValidated) return "partial";
      return "pending";
    }
  }

  // No installments: infer from submissions
  const subStatuses = submissions.map(s => (s.status || "pending").toLowerCase());
  if (!subStatuses.length) return "pending";
  if (requiresValidation){
    return subStatuses.includes("validated") ? "validated" : "pending";
  } else {
    return subStatuses.includes("paid") || subStatuses.includes("validated") ? "paid" : "pending";
  }
}

/* =========================
   Boot
========================= */
watchAuth(async (user) => {
  if (!user) return;
  if (!mid){
    showAlert("Falta el parámetro mid en la URL.", "danger");
    return;
  }
  midText.textContent = mid;
  await refreshAll();
});

btnRefresh.addEventListener("click", refreshAll);

/* =========================
   Load
========================= */
async function refreshAll(){
  showLoader?.("Cargando membresía…");
  try{
    await loadMembership();
    await loadInstallments();
    await loadSubmissions();
    render();

    // Recalculate and persist if changed
    await reconcileMembershipStatus();

    hideAlert();
  } catch (e){
    console.error(e);
    showAlert("No se pudo cargar la membresía (revisá el mid).", "danger");
  } finally {
    hideLoader?.();
  }
}

async function loadMembership(){
  const snap = await getDoc(doc(db, COL_MEMBERSHIPS, mid));
  if (!snap.exists()) throw new Error("membership_not_found");
  membership = { id: snap.id, ...snap.data() };
}

async function loadInstallments(){
  const q = query(collection(db, COL_INSTALLMENTS), where("membershipId", "==", mid));
  const snap = await getDocs(q);
  installments = snap.docs.map(d => ({ id:d.id, ...d.data() }))
    .sort((a,b) => (a.n||0)-(b.n||0));
}

async function loadSubmissions(){
  const q = query(collection(db, COL_SUBMISSIONS), where("membershipId", "==", mid));
  const snap = await getDocs(q);
  submissions = snap.docs.map(d => ({ id:d.id, ...d.data() }))
    .sort((a,b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
}

/* =========================
   Render
========================= */
function render(){
  const a = membership.associateSnapshot || {};
  const p = membership.planSnapshot || {};
  const cur = getCurrency();

  assocName.textContent = a.fullName || "—";
  assocContact.textContent = [a.email || null, a.phone || null].filter(Boolean).join(" • ") || "—";

  planName.textContent = p.name || "—";
  const totalTxt = p.allowCustomAmount
    ? "Monto editable"
    : fmtMoney(membership.totalAmount ?? p.totalAmount, cur);

  planMeta.textContent = `${totalTxt} • ${p.allowPartial ? "Permite cuotas" : "Pago único"} • ${p.requiresValidation ? "Validación admin" : "Sin validación"}`;

  seasonText.textContent = membership.season || "—";
  statusBadge.innerHTML = statusBadgeHtml(membership.status);

  // Pay link
  const url = payUrl(mid, membership.payCode || "");
  btnOpenPayLink.href = url;

  btnCopyPayLink.onclick = async () => {
    try{
      await navigator.clipboard.writeText(url);
      alert("✅ Link copiado");
    }catch{
      prompt("Copiá el link:", url);
    }
  };

  renderInstallments();
  renderSubmissions();
}

function renderInstallments(){
  const cur = getCurrency();
  installmentsCount.textContent = `${installments.length} cuota(s)`;

  if (!installments.length){
    installmentsTbody.innerHTML = `<tr><td colspan="4" class="text-muted">Este plan no tiene cuotas (pago único).</td></tr>`;
    return;
  }

  installmentsTbody.innerHTML = installments.map(it => {
    const due = it.dueDate || (it.dueMonthDay ? `${membership.season}-${it.dueMonthDay}` : "—");
    const st = (it.status || "pending").toLowerCase();
    return `
      <tr>
        <td class="fw-bold">${it.n ?? "—"}</td>
        <td>${due}</td>
        <td>${fmtMoney(it.amount, cur)}</td>
        <td>${statusBadgeHtml(st)}</td>
      </tr>
    `;
  }).join("");
}

function renderSubmissions(){
  const cur = getCurrency();
  subsCount.textContent = `${submissions.length} envío(s)`;

  if (!submissions.length){
    subsTbody.innerHTML = `<tr><td colspan="5" class="text-muted">Aún no hay comprobantes enviados.</td></tr>`;
    return;
  }

  subsTbody.innerHTML = submissions.map(s => {
    const st = (s.status || "pending").toLowerCase();
    const when = toDateText(s.createdAt);
    const fileLink = s.fileUrl
      ? `<a class="btn btn-sm btn-outline-dark" href="${s.fileUrl}" target="_blank" rel="noreferrer">Ver</a>`
      : `<span class="text-muted">—</span>`;

    const it = s.installmentId ? getInstallmentById(s.installmentId) : null;
    const itLabel = it ? `Cuota #${it.n}` : "General";

    const detail = `
      <div class="fw-bold">${s.payerName || "—"}</div>
      <div class="small text-muted">${itLabel} • ${s.method || "—"}</div>
      ${s.note ? `<div class="small text-muted">Nota: ${s.note}</div>` : ""}
      ${s.adminNote ? `<div class="small text-danger">Admin: ${s.adminNote}</div>` : ""}
      <div class="mt-1">${fileLink}</div>
    `;

    const actions = `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-secondary" data-action="paid" data-sid="${s.id}">
          Pagado
        </button>
        <button class="btn btn-outline-success" data-action="validated" data-sid="${s.id}">
          Validar
        </button>
        <button class="btn btn-outline-danger" data-action="reject" data-sid="${s.id}">
          Rechazar
        </button>
      </div>
    `;

    return `
      <tr>
        <td style="white-space:nowrap;">${when}</td>
        <td>${detail}</td>
        <td style="white-space:nowrap;">${fmtMoney(s.amountReported, cur)}</td>
        <td>${statusBadgeHtml(st)}</td>
        <td class="text-end">${actions}</td>
      </tr>
    `;
  }).join("");
}

/* =========================
   Actions
========================= */
subsTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const sid = btn.dataset.sid;
  const sub = submissions.find(x => x.id === sid);
  if (!sub) return;

  if (action === "reject"){
    rejectSid.value = sid;
    rejectNote.value = "";
    rejectModal.show();
    return;
  }

  if (action === "paid"){
    await setSubmissionStatus(sub, "paid");
    return;
  }

  if (action === "validated"){
    await setSubmissionStatus(sub, "validated");
    return;
  }
});

btnConfirmReject.addEventListener("click", async () => {
  const sid = rejectSid.value;
  const sub = submissions.find(x => x.id === sid);
  if (!sub) return;

  const noteTxt = (rejectNote.value || "").trim();
  await setSubmissionStatus(sub, "rejected", noteTxt || null);
  rejectModal.hide();
});

async function setSubmissionStatus(sub, newStatus, adminNote = null){
  const label = newStatus === "paid" ? "Marcando pagado…" :
                newStatus === "validated" ? "Validando…" :
                newStatus === "rejected" ? "Rechazando…" : "Actualizando…";

  showLoader?.(label);

  try{
    // Update submission
    await updateDoc(doc(db, COL_SUBMISSIONS, sub.id), {
      status: newStatus,
      adminNote: adminNote ?? null,
      updatedAt: serverTimestamp()
    });

    // If linked installment, update installment status too (simple rule)
    if (sub.installmentId){
      const newInstStatus = newStatus === "validated" ? "validated"
                        : newStatus === "paid" ? "paid"
                        : newStatus === "rejected" ? "pending"
                        : "pending";

      await updateDoc(doc(db, COL_INSTALLMENTS, sub.installmentId), {
        status: newInstStatus,
        updatedAt: serverTimestamp()
      });
    }

    // reload + reconcile
    await loadInstallments();
    await loadSubmissions();
    await reconcileMembershipStatus();

    render();
    alert("✅ Actualizado");
  } catch (e){
    console.error(e);
    alert("❌ Error actualizando: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
}

/* =========================
   Reconcile membership status
========================= */
async function reconcileMembershipStatus(){
  const next = computeMembershipStatus();
  const curr = (membership.status || "pending").toLowerCase();

  if (next !== curr){
    await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
      status: next,
      updatedAt: serverTimestamp()
    });
    membership.status = next;
  }
}
