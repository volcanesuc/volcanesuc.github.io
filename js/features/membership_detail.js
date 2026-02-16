import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { loadHeader } from "../components/header.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  doc,
  getDoc,
  getDocs,
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

/* Apply (multi-installments) modal */
const applyModalEl = document.getElementById("applyModal");
const applyModal = applyModalEl ? new bootstrap.Modal(applyModalEl) : null;
const applySid = document.getElementById("applySid");
const applyList = document.getElementById("applyList");
const applyReported = document.getElementById("applyReported");
const applySelectedTotal = document.getElementById("applySelectedTotal");
const applyDiff = document.getElementById("applyDiff");
const applyAdminNote = document.getElementById("applyAdminNote");
const btnConfirmApplyValidate = document.getElementById("btnConfirmApplyValidate");

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

function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function isInstallmentSettled(it) {
  const st = norm(it?.status || "pending");
  return st === "validated" || st === "paid";
}

function pendingInstallments() {
  return installments.filter((it) => !isInstallmentSettled(it));
}

function sumAmounts(arr) {
  return (arr || []).reduce((acc, x) => acc + (Number(x?.amount) || 0), 0);
}

/* =========================
   Status reconcile
========================= */
function computeMembershipStatus() {
  const p = membership?.planSnapshot || {};
  const requiresValidation = !!p.requiresValidation;

  // con cuotas: status por cuotas (source of truth)
  if (installments.length) {
    const sts = installments.map((i) => norm(i.status || "pending"));
    const anyPaidOrValidated = sts.some((s) => s === "paid" || s === "validated");
    const allValidated = sts.every((s) => s === "validated");
    const allPaidOrValidated = sts.every((s) => s === "paid" || s === "validated");

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

  // sin cuotas: por submissions
  const subStatuses = submissions.map((s) => norm(s.status || "pending"));
  if (!subStatuses.length) return "pending";

  if (requiresValidation) {
    return subStatuses.includes("validated") ? "validated" : "pending";
  }
  return (subStatuses.includes("paid") || subStatuses.includes("validated")) ? "paid" : "pending";
}

async function reconcileMembershipStatus() {
  const next = computeMembershipStatus();
  const curr = norm(membership?.status || "pending");
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
    const st = norm(it.status || "pending");

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
    const st = norm(s.status || "pending");
    const when = toDateText(s.createdAt);

    const it = s.installmentId ? getInstallmentById(s.installmentId) : null;
    const itLabel = it ? `Cuota #${it.n}` : "General";

    const fileLink = s.fileUrl
      ? `<a class="btn btn-sm btn-outline-dark" href="${s.fileUrl}" target="_blank" rel="noreferrer">Ver</a>`
      : `<span class="text-muted">—</span>`;

    const applied = Array.isArray(s.appliedInstallmentIds) && s.appliedInstallmentIds.length
      ? `<div class="small text-muted">Aplicado a: ${s.appliedInstallmentIds.length} cuota(s)</div>`
      : "";

    const detail = `
      <div class="fw-bold">${s.payerName || "—"}</div>
      <div class="small text-muted">${itLabel} • ${s.method || "—"}</div>
      ${applied}
      ${s.note ? `<div class="small text-muted">Nota: ${s.note}</div>` : ""}
      ${s.adminNote ? `<div class="small text-danger">Admin: ${s.adminNote}</div>` : ""}
      <div class="mt-1">${fileLink}</div>
    `;

    const locked = st === "validated" || st === "rejected";
    const canApply = !locked && installments.length > 0;

    const actions = `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-success" data-action="validated" data-sid="${s.id}" ${locked ? "disabled" : ""}>
          Validar
        </button>
        <button class="btn btn-outline-danger" data-action="reject" data-sid="${s.id}" ${locked ? "disabled" : ""}>
          Rechazar
        </button>
        <button class="btn btn-outline-secondary" data-action="apply" data-sid="${s.id}" ${canApply ? "" : "disabled"}>
          Aplicar cuotas
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
   Apply modal (multi cuotas)
========================= */
function greedySuggestInstallments(reportAmount, pendingList) {
  const amt = Number(reportAmount) || 0;
  if (!amt || !pendingList?.length) return [];
  const sorted = [...pendingList].sort((a, b) => (a.n || 0) - (b.n || 0));

  const out = [];
  let acc = 0;
  for (const it of sorted) {
    const v = Number(it.amount) || 0;
    if (acc + v <= amt) {
      out.push(it.id);
      acc += v;
    } else {
      // si no cabe, lo saltamos (admin puede ajustar)
    }
  }
  // fallback: si no seleccionó nada, al menos sugerir la primera pendiente
  if (!out.length && sorted[0]) out.push(sorted[0].id);
  return out;
}

function renderApplyModalForSubmission(sub) {
  if (!applyModal || !applyList || !applySid) {
    alert("Falta el modal applyModal en el HTML.");
    return;
  }

  const cur = getCurrency();
  const pending = pendingInstallments();

  applySid.value = sub.id;

  const reported = Number(sub.amountReported) || 0;
  if (applyReported) applyReported.textContent = fmtMoney(reported, cur);

  // sugerencia: por monto reportado
  const suggestedIds = greedySuggestInstallments(reported, pending);

  // si submission venía con installmentId, lo pre-seleccionamos (y lo sumamos a sugeridos)
  const pre = new Set(suggestedIds);
  if (sub.installmentId) pre.add(sub.installmentId);

  // si ya tenía appliedInstallmentIds, se respetan
  if (Array.isArray(sub.appliedInstallmentIds) && sub.appliedInstallmentIds.length) {
    pre.clear();
    sub.appliedInstallmentIds.forEach((id) => pre.add(id));
  }

  applyList.innerHTML = pending.map((it) => {
    const due = it.dueDate || (it.dueMonthDay ? `${membership.season}-${it.dueMonthDay}` : "—");
    const checked = pre.has(it.id) ? "checked" : "";
    return `
      <label class="list-group-item d-flex justify-content-between align-items-center">
        <span>
          <span class="fw-bold">Cuota #${it.n ?? "—"}</span>
          <span class="text-muted small ms-2">vence ${due}</span>
        </span>
        <span class="d-flex align-items-center gap-3">
          <span class="mono">${fmtMoney(it.amount, cur)}</span>
          <input class="form-check-input" type="checkbox" data-itid="${it.id}" ${checked} />
        </span>
      </label>
    `;
  }).join("") || `<div class="text-muted p-2">No hay cuotas pendientes.</div>`;

  if (applyAdminNote) applyAdminNote.value = sub.adminNote || "";

  // calcular totales iniciales
  recalcApplyTotals();

  // listeners
  applyList.querySelectorAll('input[type="checkbox"][data-itid]').forEach((cb) => {
    cb.addEventListener("change", recalcApplyTotals);
  });

  applyModal.show();
}

function getApplySelectedIds() {
  if (!applyList) return [];
  return [...applyList.querySelectorAll('input[type="checkbox"][data-itid]:checked')]
    .map((x) => x.getAttribute("data-itid"))
    .filter(Boolean);
}

function recalcApplyTotals() {
  const cur = getCurrency();
  const ids = getApplySelectedIds();
  const selected = ids.map(getInstallmentById).filter(Boolean);
  const total = sumAmounts(selected);

  if (applySelectedTotal) applySelectedTotal.textContent = fmtMoney(total, cur);

  const sid = applySid?.value;
  const sub = submissions.find((x) => x.id === sid);
  const reported = Number(sub?.amountReported) || 0;

  if (applyDiff) {
    const diff = reported - total;
    const sign = diff === 0 ? "" : diff > 0 ? "Sobra" : "Falta";
    applyDiff.textContent =
      reported && total
        ? `${sign}: ${fmtMoney(Math.abs(diff), cur)}`
        : "—";

    applyDiff.className =
      diff === 0 ? "text-success small" :
      diff > 0 ? "text-warning small" :
      "text-danger small";
  }
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

  const st = norm(sub.status || "pending");
  if (st === "validated" || st === "rejected") return;

  if (action === "reject") {
    if (!rejectModal) return;
    rejectSid.value = sid;
    rejectNote.value = "";
    rejectModal.show();
    return;
  }

  if (action === "apply") {
    renderApplyModalForSubmission(sub);
    return;
  }

  if (action === "validated") {
    // Si hay cuotas y no hay installmentId, abrir modal para aplicar.
    // Si sí hay installmentId, igual permitimos validar directo (aplica 1 cuota).
    const hasInstallments = installments.length > 0;
    const needsApplyModal = hasInstallments && !sub.installmentId;

    if (needsApplyModal) {
      renderApplyModalForSubmission(sub);
      return;
    }

    await setSubmissionValidatedWithInstallments(sub, sub.installmentId ? [sub.installmentId] : [], sub.adminNote || null);
    return;
  }
});

btnConfirmReject?.addEventListener("click", async () => {
  const sid = rejectSid.value;
  const sub = submissions.find((x) => x.id === sid);
  if (!sub) return;

  const noteTxt = (rejectNote.value || "").trim();
  await setSubmissionRejected(sub, noteTxt || "Rechazado por admin");
  rejectModal?.hide();
});

btnConfirmApplyValidate?.addEventListener("click", async () => {
  const sid = applySid?.value;
  const sub = submissions.find((x) => x.id === sid);
  if (!sub) return;

  const ids = getApplySelectedIds();
  const note = (applyAdminNote?.value || "").trim() || null;

  if (!ids.length) {
    alert("Seleccioná al menos 1 cuota.");
    return;
  }

  applyModal?.hide();
  await setSubmissionValidatedWithInstallments(sub, ids, note);
});

async function setSubmissionRejected(sub, adminNote = null) {
  showLoader?.("Rechazando…");
  try {
    await updateDoc(doc(db, COL_SUBMISSIONS, sub.id), {
      status: "rejected",
      adminNote: adminNote ?? null,
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // habilitar link para que re-envíe
    await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
      payLinkEnabled: true,
      payLinkDisabledReason: null,
      updatedAt: serverTimestamp()
    });
    membership.payLinkEnabled = true;
    membership.payLinkDisabledReason = null;

    await loadInstallments();
    await loadSubmissions();
    await reconcileMembershipStatus();
    render();
    alert("✅ Rechazado");
  } catch (e) {
    console.error(e);
    alert("❌ Error rechazando: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
}

async function setSubmissionValidatedWithInstallments(sub, installmentIds = [], adminNote = null) {
  showLoader?.("Validando…");

  try {
    // 1) actualiza submission
    const appliedIds = [...new Set((installmentIds || []).filter(Boolean))];
    const selected = appliedIds.map(getInstallmentById).filter(Boolean);
    const appliedTotal = sumAmounts(selected);

    await updateDoc(doc(db, COL_SUBMISSIONS, sub.id), {
      status: "validated",
      adminNote: adminNote ?? null,
      appliedInstallmentIds: appliedIds.length ? appliedIds : null,
      appliedTotal: appliedIds.length ? appliedTotal : null,
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2) actualiza cuotas seleccionadas
    for (const itid of appliedIds) {
      await updateDoc(doc(db, COL_INSTALLMENTS, itid), {
        status: "validated",
        paymentSubmissionId: sub.id,
        validatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // 3) refresca data
    await loadInstallments();
    await loadSubmissions();

    // 4) status membership
    await reconcileMembershipStatus();

    // 5) payLinkEnabled: si aún debe cuotas -> habilitar
    const stillPending = pendingInstallments().length > 0;

    await updateDoc(doc(db, COL_MEMBERSHIPS, mid), {
      lastPaymentSubmissionId: sub.id,
      lastPaymentAt: serverTimestamp(),
      payLinkEnabled: stillPending, // ✅ ESTE ES EL FIX CLAVE
      payLinkDisabledReason: stillPending ? null : "Membresía al día.",
      updatedAt: serverTimestamp()
    });

    membership.payLinkEnabled = stillPending;
    membership.payLinkDisabledReason = stillPending ? null : "Membresía al día.";

    render();
    alert(stillPending ? "✅ Validado. Quedan cuotas pendientes (link habilitado)." : "✅ Validado. Ya está al día (link bloqueado).");
  } catch (e) {
    console.error(e);
    alert("❌ Error validando: " + (e?.message || e));
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
