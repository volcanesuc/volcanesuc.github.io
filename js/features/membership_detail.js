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

const btnDisablePayLink = document.getElementById("btnDisablePayLink");
const btnEnablePayLink = document.getElementById("btnEnablePayLink");

const installmentsCount = document.getElementById("installmentsCount");
const installmentsTbody = document.getElementById("installmentsTbody");

const subsCount = document.getElementById("subsCount");
const subsTbody = document.getElementById("subsTbody");

/* Reject modal */
const rejectModalEl = document.getElementById("rejectModal");
const rejectModal = rejectModalEl ? new bootstrap.Modal(rejectModalEl) : null;
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
function showAlert(msg, type = "warning") {
  if (!alertBox) return alert(msg);
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove("d-none");
}
function hideAlert() {
  alertBox?.classList.add("d-none");
}

function fmtMoney(n, cur = "CRC") {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0
  }).format(v);
}

function badge(text, cls = "") {
  return `<span class="badge-soft ${cls}">${text}</span>`;
}

function statusBadgeHtml(st) {
  const s = (st || "pending").toLowerCase();
  if (s === "validated") return badge("Validado", "green");
  if (s === "paid") return badge("Pagado", "yellow");
  if (s === "partial") return badge("Parcial", "yellow");
  if (s === "rejected") return badge("Rechazado", "red");
  if (s === "inactive") return badge("Inactivo", "gray");
  return badge("Pendiente", "gray");
}

function toDateText(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getCurrency() {
  return membership?.currency || membership?.planSnapshot?.currency || "CRC";
}

function payUrl(mid, code) {
  const base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]+$/, "/")}`;
  return `${base}membership_pay.html?mid=${encodeURIComponent(mid)}&code=${encodeURIComponent(code || "")}`;
}

function getInstallmentById(id) {
  return installments.find((x) => x.id === id) || null;
}

/* =========================
   Status reconcile
========================= */
function computeMembershipStatus() {
  const p = membership?.planSnapshot || {};
  const requiresValidation = !!p.requiresValidation;

  // con cuotas: inferimos por estado de cuotas
  if (installments.length) {
    const statuses = installments.map((i) => (i.status || "pending").toLowerCase());
    const anyPaidOrValidated = statuses.some((s) => s === "paid" || s === "validated");
    const allValidated = statuses.every((s) => s === "validated");
    const allPaidOrValidated = statuses.every((s) => s === "paid" || s === "validated");

    if (requiresValidation) {
      if (allValidated) return "validated";
      if (anyPaidOrValidated) return "partial";
      return "pending";
    } else {
      if (allPaidOrValidated) return "paid";
      if (anyPaidOrValidated) return "partial";
      return "pending";
    }
  }

  // sin cuotas: inferimos por submissions
  const subStatuses = submissions.map((s) => (s.status || "pending").toLowerCase());
  if (!subStatuses.length) return "pending";

  if (requiresValidation) {
    return subStatuses.includes("validated") ? "validated" : "pending";
  }
  return (subStatuses.includes("paid") || subStatuses.includes("validated")) ? "paid" : "pending";
}

async function reconcileMembershipStatus() {
  const next = computeMembershipStatus();
  const curr = (membership?.status || "pending").toLowerCase();

  if (next !== curr) {
    await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
      status: next,
      updatedAt: serverTimestamp()
    });
    membership.status = next;
  }
}

/* =========================
   Loaders
========================= */
async function loadMembership() {
  const snap = await getDoc(doc(db, COL_MEMBERSHIPS, mid));
  if (!snap.exists()) throw new Error("membership_not_found");
  membership = { id: snap.id, ...snap.data() };
}

async function loadInstallments() {
  const q = query(collection(db, COL_INSTALLMENTS), where("membershipId", "==", mid));
  const snap = await getDocs(q);
  installments = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.n || 0) - (b.n || 0));
}

async function loadSubmissions() {
  const q = query(collection(db, COL_SUBMISSIONS), where("membershipId", "==", mid));
  const snap = await getDocs(q);
  submissions = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
}

/* =========================
   Render
========================= */
function render() {
  if (!membership) return;

  const a = membership.associateSnapshot || {};
  const p = membership.planSnapshot || {};
  const cur = getCurrency();

  assocName.textContent = a.fullName || "—";
  assocContact.textContent = [a.email || null, a.phone || null].filter(Boolean).join(" • ") || "—";

  planName.textContent = p.name || "—";
  const totalTxt = p.allowCustomAmount
    ? "Monto editable"
    : fmtMoney(membership.totalAmount ?? p.totalAmount, cur);

  planMeta.textContent = `${totalTxt} • ${p.allowPartial ? "Cuotas" : "Pago único"} • ${p.requiresValidation ? "Validación admin" : "Sin validación"}`;

  midText.textContent = membership.id || mid;
  seasonText.textContent = membership.season || "—";
  statusBadge.innerHTML = statusBadgeHtml(membership.status);

  // Pay link UI
  const url = payUrl(mid, membership.payCode || "");
  btnOpenPayLink.href = url;

  btnCopyPayLink.onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert("✅ Link copiado");
    } catch {
      prompt("Copiá el link:", url);
    }
  };

  // Pay link enable/disable buttons
  const enabled = membership.payLinkEnabled !== false;
  btnDisablePayLink && (btnDisablePayLink.style.display = enabled ? "inline-block" : "none");
  btnEnablePayLink && (btnEnablePayLink.style.display = enabled ? "none" : "inline-block");

  renderInstallments();
  renderSubmissions();
}

function renderInstallments() {
  const cur = getCurrency();
  installmentsCount.textContent = `${installments.length} cuota(s)`;

  if (!installments.length) {
    installmentsTbody.innerHTML = `<tr><td colspan="4" class="text-muted">Este plan no tiene cuotas (pago único).</td></tr>`;
    return;
  }

  installmentsTbody.innerHTML = installments.map((it) => {
    const due = it.dueDate || (it.dueMonthDay ? `${membership.season}-${it.dueMonthDay}` : "—");
    const st = (it.status || "pending").toLowerCase();

    return `
      <tr>
        <td class="fw-bold">${it.n ?? "—"}</td>
        <td>${due}</td>
        <td style="white-space:nowrap;">${fmtMoney(it.amount, cur)}</td>
        <td>${statusBadgeHtml(st)}</td>
      </tr>
    `;
  }).join("");
}

function renderSubmissions() {
  const cur = getCurrency();
  subsCount.textContent = `${submissions.length} envío(s)`;

  if (!submissions.length) {
    subsTbody.innerHTML = `<tr><td colspan="5" class="text-muted">Aún no hay comprobantes enviados.</td></tr>`;
    return;
  }

  subsTbody.innerHTML = submissions.map((s) => {
    const st = (s.status || "pending").toLowerCase();
    const when = toDateText(s.createdAt);

    const it = s.installmentId ? getInstallmentById(s.installmentId) : null;
    const itLabel = it ? `Cuota #${it.n}` : "General";

    const fileLink = s.fileUrl
      ? `<a class="btn btn-sm btn-outline-dark" href="${s.fileUrl}" target="_blank" rel="noreferrer">Ver</a>`
      : `<span class="text-muted">—</span>`;

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
   Actions (submissions)
========================= */
subsTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const sid = btn.dataset.sid;
  const sub = submissions.find((x) => x.id === sid);
  if (!sub) return;

  if (action === "reject") {
    if (!rejectModal) return;
    rejectSid.value = sid;
    rejectNote.value = "";
    rejectModal.show();
    return;
  }

  if (action === "paid") {
    await setSubmissionStatus(sub, "paid");
    return;
  }

  if (action === "validated") {
    await setSubmissionStatus(sub, "validated");
  }
});

btnConfirmReject?.addEventListener("click", async () => {
  const sid = rejectSid.value;
  const sub = submissions.find((x) => x.id === sid);
  if (!sub) return;

  const noteTxt = (rejectNote.value || "").trim();
  await setSubmissionStatus(sub, "rejected", noteTxt || "Rechazado por admin");
  rejectModal?.hide();
});

async function setSubmissionStatus(sub, newStatus, adminNote = null) {
  const label =
    newStatus === "paid" ? "Marcando pagado…" :
    newStatus === "validated" ? "Validando…" :
    newStatus === "rejected" ? "Rechazando…" : "Actualizando…";

  showLoader?.(label);

  try {
    // 1) Update submission
    await updateDoc(doc(db, COL_SUBMISSIONS, sub.id), {
      status: newStatus,
      adminNote: adminNote ?? null,
      updatedAt: serverTimestamp()
    });

    // 2) If linked installment, update installment too
    if (sub.installmentId) {
      const newInstStatus =
        newStatus === "validated" ? "validated" :
        newStatus === "paid" ? "paid" :
        // si se rechaza, devolvemos a pendiente para que pueda reenviar
        "pending";

      await updateDoc(doc(db, COL_INSTALLMENTS, sub.installmentId), {
        status: newInstStatus,
        updatedAt: serverTimestamp()
      });
    }

    // 3) Auto-enable/disable pay link
    //    - paid/validated => bloquear
    //    - rejected => habilitar (para que pueda reenviar)
    if (newStatus === "paid" || newStatus === "validated") {
      await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
        payLinkEnabled: false,
        payLinkDisabledReason: "Pago registrado por admin.",
        updatedAt: serverTimestamp()
      });
      // mantenemos state local consistente sin reload extra
      membership.payLinkEnabled = false;
      membership.payLinkDisabledReason = "Pago registrado por admin.";
    } else if (newStatus === "rejected") {
      await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
        payLinkEnabled: true,
        payLinkDisabledReason: null,
        updatedAt: serverTimestamp()
      });
      membership.payLinkEnabled = true;
      membership.payLinkDisabledReason = null;
    }

    // 4) Reload + reconcile status
    await loadInstallments();
    await loadSubmissions();
    await reconcileMembershipStatus();

    // 5) Reload membership (opcional)
    // Si querés 100% exactitud desde server, descomentá:
    // await loadMembership();

    render();
    alert("✅ Actualizado");

  } catch (e) {
    console.error(e);
    alert("❌ Error actualizando: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
}


/* =========================
   Pay link controls (ADMIN)
========================= */
btnDisablePayLink?.addEventListener("click", async () => {
  if (!confirm("¿Bloquear el link de pago?")) return;

  showLoader?.("Bloqueando…");
  try {
    await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
      payLinkEnabled: false,
      payLinkDisabledReason: "Link bloqueado por admin.",
      updatedAt: serverTimestamp()
    });

    await loadMembership();
    render();
    alert("✅ Link bloqueado");
  } catch (e) {
    console.error(e);
    alert("❌ Error bloqueando link: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
});

btnEnablePayLink?.addEventListener("click", async () => {
  if (!confirm("¿Habilitar el link de pago nuevamente?")) return;

  showLoader?.("Habilitando…");
  try {
    await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
      payLinkEnabled: true,
      payLinkDisabledReason: null,
      updatedAt: serverTimestamp()
    });

    await loadMembership();
    render();
    alert("✅ Link habilitado");
  } catch (e) {
    console.error(e);
    alert("❌ Error habilitando link: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
});

/* =========================
   Boot
========================= */
btnRefresh?.addEventListener("click", async () => {
  await refreshAll();
});

watchAuth(async (user) => {
  if (!user) return;

  if (!mid) {
    showAlert("Falta el parámetro mid en la URL.", "danger");
    return;
  }

  await refreshAll();
});

async function refreshAll() {
  showLoader?.("Cargando membresía…");
  try {
    await loadMembership();
    await loadInstallments();
    await loadSubmissions();

    await reconcileMembershipStatus();
    render();
    hideAlert();
  } catch (e) {
    console.error(e);
    showAlert("No se pudo cargar la membresía.", "danger");
  } finally {
    hideLoader?.();
  }
}
