// js/features/payments_admin.js
// Admin tab: lista membership_payment_submissions + acciones Validar/Rechazar
// FIX: al validar/rechazar SIEMPRE sincroniza memberships/{membershipId}
//      (aunque installmentId sea null, típico de mensual)

import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Collections
========================= */
const COL_SUBMISSIONS = "membership_payment_submissions";
const COL_MEMBERSHIPS = "memberships";
const COL_INSTALLMENTS = "membership_installments";
const DEFAULT_LIMIT = 300;

/* =========================
   State
========================= */
let $ = {};
let allSubs = [];
let currentSub = null;
let _busy = false;

/* =========================
   Helpers
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}
function esc(s) {
  return (s ?? "—")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function pick(obj, keys, fallback = null) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}
function fmtMoney(n, cur = "CRC") {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(v);
}
function fmtDate(ts) {
  try {
    if (!ts) return "—";
    if (ts.toDate) return ts.toDate().toLocaleString("es-CR");
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-CR");
  } catch {
    return "—";
  }
}
function badge(text, cls = "gray") {
  return `<span class="badge-soft ${cls}">${esc(text)}</span>`;
}
function statusBadge(st) {
  const s = (st || "pending").toString().toLowerCase();
  if (s === "validated" || s === "approved") return badge("Validado", "green");
  if (s === "rejected") return badge("Rechazado", "red");
  if (s === "paid") return badge("Pagado", "yellow");
  return badge("Pendiente", "gray");
}
function methodLabel(m) {
  const s = (m || "").toString().toLowerCase();
  if (s === "sinpe") return "SINPE";
  if (s === "transfer") return "Transferencia";
  if (s === "cash") return "Efectivo";
  if (s === "card") return "Tarjeta";
  return m ? String(m) : "—";
}
function setBusy(on) {
  _busy = !!on;
  if ($.btnApprove) $.btnApprove.disabled = _busy || !currentSub;
  if ($.btnReject) $.btnReject.disabled = _busy || !currentSub;
  if ($.btnSaveNote) $.btnSaveNote.disabled = _busy || !currentSub;
}

/* =========================
   Shell
========================= */
function renderShell(container) {
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
      <div class="text-muted small">Pagos recibidos por asociados</div>
      <div class="d-flex gap-2">
        <button id="btnRefresh" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-arrow-clockwise me-1"></i> Refrescar
        </button>
      </div>
    </div>

    <div class="row g-2">
      <div class="col-12 col-md-5">
        <input id="searchInput" class="form-control" placeholder="Buscar por nombre, email, phone, membershipId..." />
      </div>

      <div class="col-6 col-md-3">
        <select id="seasonFilter" class="form-select">
          <option value="all">Todas las temporadas</option>
        </select>
      </div>

      <div class="col-6 col-md-4">
        <select id="statusFilter" class="form-select">
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="validated">Validado</option>
          <option value="rejected">Rechazado</option>
        </select>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mt-2">
      <div id="countLabel" class="text-muted small">—</div>
      <div id="sumLabel" class="text-muted small">—</div>
    </div>

    <div class="table-responsive mt-2">
      <table class="table align-middle">
        <thead>
          <tr>
            <th style="width:170px;">Fecha</th>
            <th>Asociado</th>
            <th>Membresía</th>
            <th>Estado</th>
            <th>Método</th>
            <th>Comprobante</th>
            <th>Monto</th>
            <th class="text-end">Acciones</th>
          </tr>
        </thead>
        <tbody id="subsTbody">
          <tr><td colspan="8" class="text-muted">Cargando…</td></tr>
        </tbody>
      </table>
    </div>

    ${renderModalHtml()}
  `;
}

function renderModalHtml() {
  return `
  <div class="modal fade" id="submissionModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <div class="small text-muted">Submission</div>
            <h5 class="modal-title mb-0" id="submissionModalTitle">Detalle</h5>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>

        <div class="modal-body">
          <div id="submissionQuick" class="mb-3"></div>

          <div class="card border-0 bg-light">
            <div class="card-body">
              <label class="form-label mb-1">Nota admin</label>
              <textarea id="adminNoteInput" class="form-control" rows="2" placeholder="Opcional: comentario interno o razón de rechazo..."></textarea>
              <div class="d-flex justify-content-between align-items-center mt-2">
                <div class="small text-muted" id="membershipSyncHint">—</div>
                <button id="btnSaveNote" class="btn btn-sm btn-outline-secondary" type="button">
                  Guardar nota
                </button>
              </div>
            </div>
          </div>

          <pre id="submissionJson" class="small bg-light p-2 rounded mt-3" style="white-space:pre-wrap;"></pre>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cerrar</button>
          <button id="btnReject" class="btn btn-outline-danger" type="button">
            <i class="bi bi-x-circle me-1"></i> Rechazar
          </button>
          <button id="btnApprove" class="btn btn-success" type="button">
            <i class="bi bi-check-circle me-1"></i> Validar
          </button>
        </div>
      </div>
    </div>
  </div>
  `;
}

function cacheDom(container) {
  const root = container || document;

  $.root = root;
  $.logoutBtn = document.getElementById("logoutBtn");

  $.btnRefresh = root.querySelector("#btnRefresh");
  $.searchInput = root.querySelector("#searchInput");
  $.seasonFilter = root.querySelector("#seasonFilter");
  $.statusFilter = root.querySelector("#statusFilter");

  $.countLabel = root.querySelector("#countLabel");
  $.sumLabel = root.querySelector("#sumLabel");
  $.tbody = root.querySelector("#subsTbody");

  $.modalEl = root.querySelector("#submissionModal");
  $.modal = $.modalEl ? new bootstrap.Modal($.modalEl) : null;
  $.modalTitle = root.querySelector("#submissionModalTitle");
  $.modalJson = root.querySelector("#submissionJson");
  $.modalQuick = root.querySelector("#submissionQuick");

  $.adminNoteInput = root.querySelector("#adminNoteInput");
  $.membershipSyncHint = root.querySelector("#membershipSyncHint");

  $.btnApprove = root.querySelector("#btnApprove");
  $.btnReject = root.querySelector("#btnReject");
  $.btnSaveNote = root.querySelector("#btnSaveNote");
}

/* =========================
   Data loading
========================= */
async function loadSubmissions() {
  showLoader?.("Cargando pagos…");

  let snap;
  try {
    const q = query(
      collection(db, COL_SUBMISSIONS),
      orderBy("createdAt", "desc"),
      limit(DEFAULT_LIMIT)
    );
    snap = await getDocs(q);
  } catch (e) {
    console.warn("No se pudo orderBy(createdAt). Cargando sin order:", e);
    snap = await getDocs(collection(db, COL_SUBMISSIONS));
  }

  allSubs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  fillSeasonFilterFromData();
  render();

  hideLoader?.();
}

function getSeason(s) {
  return pick(s, ["season"], "—");
}
function getMembershipId(s) {
  return pick(s, ["membershipId"], null);
}
function getInstallmentId(s) {
  return pick(s, ["installmentId"], null);
}
function getAssociateCell(s) {
  const name = pick(s, ["payerName"], "—");
  const email = pick(s, ["email"], null);
  const phone = pick(s, ["phone"], null);
  const lines = [email, phone].filter(Boolean).join(" • ");
  return `
    <div class="fw-bold tight">${esc(name)}</div>
    <div class="small text-muted tight">${lines ? esc(lines) : "—"}</div>
  `;
}
function getAmount(s) {
  return pick(s, ["amountReported"], null);
}
function getCurrency(s) {
  return pick(s, ["currency"], "CRC");
}
function getMethod(s) {
  return pick(s, ["method"], "—");
}
function getFileUrl(s) {
  return pick(s, ["fileUrl"], null);
}

function fillSeasonFilterFromData() {
  if (!$.seasonFilter) return;

  const curr = $.seasonFilter.value || "all";
  const seasons = Array.from(new Set(allSubs.map(getSeason).filter((x) => x && x !== "—")))
    .sort((a, b) => String(b).localeCompare(String(a), "es"));

  const opts = ['<option value="all">Todas las temporadas</option>'].concat(
    seasons.map((s) => `<option value="${esc(String(s))}">${esc(String(s))}</option>`)
  );

  $.seasonFilter.innerHTML = opts.join("");

  const exists = [...$.seasonFilter.options].some((o) => o.value === curr);
  $.seasonFilter.value = exists ? curr : "all";
}

/* =========================
   Render
========================= */
function render() {
  if (!$.tbody) return;

  const qText = norm($.searchInput?.value);
  const seasonVal = $.seasonFilter?.value || "all";
  const statusVal = $.statusFilter?.value || "all";

  let list = [...allSubs];

  if (seasonVal !== "all") {
    list = list.filter((s) => String(getSeason(s)) === String(seasonVal));
  }

  if (statusVal !== "all") {
    list = list.filter((s) => norm(pick(s, ["status"], "pending")) === statusVal);
  }

  if (qText) {
    list = list.filter((s) => {
      const blob = [
        s.id,
        pick(s, ["payerName"], ""),
        pick(s, ["email"], ""),
        pick(s, ["phone"], ""),
        pick(s, ["membershipId"], ""),
        pick(s, ["installmentId"], ""),
        pick(s, ["planId"], ""),
        pick(s, ["method"], ""),
        pick(s, ["status"], ""),
        pick(s, ["amountReported"], ""),
        pick(s, ["filePath"], ""),
      ]
        .map(norm)
        .join(" ");
      return blob.includes(qText);
    });
  }

  const sum = list.reduce((acc, s) => acc + (Number(getAmount(s)) || 0), 0);

  $.countLabel.textContent = `${list.length} submissions`;
  $.sumLabel.textContent = `Suma lista: ${fmtMoney(sum, "CRC")}`;

  if (!list.length) {
    $.tbody.innerHTML = `<tr><td colspan="8" class="text-muted">No hay submissions con esos filtros.</td></tr>`;
    return;
  }

  $.tbody.innerHTML = list
    .map((s) => {
      const date = fmtDate(pick(s, ["createdAt", "updatedAt"], null));
      const membershipId = getMembershipId(s);
      const season = getSeason(s);
      const membershipCell = membershipId ? `#${esc(membershipId)} (${esc(season)})` : "—";

      const st = statusBadge(pick(s, ["status"], "pending"));
      const method = esc(methodLabel(getMethod(s)));

      const fileUrl = getFileUrl(s);
      const proof = fileUrl
        ? `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer">Abrir</a>`
        : "—";

      const amt = fmtMoney(getAmount(s), getCurrency(s));

      const viewBtn = `
        <button class="btn btn-sm btn-outline-primary" type="button" data-action="view" data-id="${s.id}">
          <i class="bi bi-eye-fill me-1"></i><span>Ver</span>
        </button>
      `;

      return `
        <tr>
          <td style="white-space:nowrap;">${date}</td>
          <td>${getAssociateCell(s)}</td>
          <td class="mono">${membershipCell}</td>
          <td>${st}</td>
          <td>${method}</td>
          <td>${proof}</td>
          <td style="white-space:nowrap;">${amt}</td>
          <td class="text-end">${viewBtn}</td>
        </tr>
      `;
    })
    .join("");
}

/* =========================
   CORE FIX: Decision sync
========================= */
async function applyDecision(sub, decision /* "validated" | "rejected" */) {
  if (!sub?.id) return;
  if (_busy) return;

  const sid = sub.id;
  const membershipId = getMembershipId(sub);
  const installmentId = getInstallmentId(sub);
  const note = ($.adminNoteInput?.value || "").trim() || null;

  setBusy(true);
  showLoader?.(decision === "validated" ? "Validando pago…" : "Rechazando pago…");

  try {
    // 1) submission
    await updateDoc(doc(db, COL_SUBMISSIONS, sid), {
      status: decision,
      adminNote: note,
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2) installment (si existe)
    if (installmentId) {
      const instStatus =
        decision === "validated" ? "validated" : "pending";
      try {
        await updateDoc(doc(db, COL_INSTALLMENTS, installmentId), {
          status: instStatus,
          updatedAt: serverTimestamp(),
          ...(decision === "validated" ? { validatedAt: serverTimestamp() } : {}),
        });
      } catch (e) {
        console.warn("[payments_admin] installment update failed:", e?.code || e);
      }
    }

    // 3) membership (SIEMPRE si membershipId existe)
    if (membershipId) {
      const mRef = doc(db, COL_MEMBERSHIPS, membershipId);
      const mSnap = await getDoc(mRef);

      if (mSnap.exists()) {
        const m = mSnap.data() || {};
        const requiresValidation = !!m?.planSnapshot?.requiresValidation;

        // ✅ status correcto según plan
        const nextStatus =
          decision === "validated"
            ? (requiresValidation ? "validated" : "paid")
            : (m.status || "pending");

        await updateDoc(mRef, {
          status: nextStatus,
          lastPaymentSubmissionId: sid,
          lastPaymentAt: serverTimestamp(),
          updatedAt: serverTimestamp(),

          ...(decision === "validated"
            ? {
                payLinkEnabled: false,
                payLinkDisabledReason: "Pago registrado por admin.",
                validatedAt: serverTimestamp(),
              }
            : {
                payLinkEnabled: true,
                payLinkDisabledReason: null,
                rejectedAt: serverTimestamp(),
              }),
        });
      } else {
        console.warn("[payments_admin] membership no existe:", membershipId);
      }
    } else {
      console.warn("[payments_admin] submission SIN membershipId, no se puede sincronizar morosidad:", sid);
    }

    // 4) refresh local list
    const idx = allSubs.findIndex((x) => x.id === sid);
    if (idx >= 0) {
      allSubs[idx] = { ...allSubs[idx], status: decision, adminNote: note };
    }

    render();
    if (currentSub?.id === sid) openView(sid, { keepOpen: true });

  } finally {
    hideLoader?.();
    setBusy(false);
  }
}

async function saveAdminNoteOnly(sub) {
  if (!sub?.id) return;
  if (_busy) return;

  const sid = sub.id;
  const note = ($.adminNoteInput?.value || "").trim() || null;

  setBusy(true);
  showLoader?.("Guardando nota…");
  try {
    await updateDoc(doc(db, COL_SUBMISSIONS, sid), {
      adminNote: note,
      updatedAt: serverTimestamp(),
    });

    const idx = allSubs.findIndex((x) => x.id === sid);
    if (idx >= 0) allSubs[idx] = { ...allSubs[idx], adminNote: note };

    if (currentSub?.id === sid) currentSub.adminNote = note;
    openView(sid, { keepOpen: true });
  } finally {
    hideLoader?.();
    setBusy(false);
  }
}

/* =========================
   Modal
========================= */
function openView(id, opts = {}) {
  const s = allSubs.find((x) => x.id === id);
  if (!s) return;

  currentSub = s;

  const membershipId = pick(s, ["membershipId"], "—");
  const installmentId = pick(s, ["installmentId"], null);
  const planId = pick(s, ["planId"], "—");
  const amount = fmtMoney(pick(s, ["amountReported"], null), pick(s, ["currency"], "CRC"));
  const status = pick(s, ["status"], "pending");
  const method = methodLabel(pick(s, ["method"], "—"));
  const proof = pick(s, ["fileUrl"], null);

  if ($.modalTitle) $.modalTitle.textContent = `#${id} • ${pick(s, ["payerName"], "—")}`;
  if ($.adminNoteInput) $.adminNoteInput.value = pick(s, ["adminNote"], "") || "";

  if ($.membershipSyncHint) {
    $.membershipSyncHint.textContent = membershipId !== "—"
      ? `Sync: memberships/${membershipId}${installmentId ? ` + installment ${installmentId}` : ""}`
      : "⚠️ Sin membershipId: no se puede actualizar morosidad automáticamente.";
  }

  if ($.modalQuick) {
    $.modalQuick.innerHTML = `
      <div class="row g-2">
        <div class="col-12 col-md-6">
          <div class="small text-muted">Membresía</div>
          <div class="mono">${membershipId !== "—" ? `#${esc(membershipId)}` : "—"}</div>
          ${installmentId ? `<div class="small text-muted mt-1">Cuota: <span class="mono">#${esc(installmentId)}</span></div>` : ""}
        </div>
        <div class="col-12 col-md-6">
          <div class="small text-muted">Plan</div>
          <div class="mono">#${esc(planId)}</div>
        </div>
        <div class="col-6 col-md-3">
          <div class="small text-muted">Monto</div>
          <div class="fw-bold">${amount}</div>
        </div>
        <div class="col-6 col-md-3">
          <div class="small text-muted">Método</div>
          <div>${esc(method)}</div>
        </div>
        <div class="col-6 col-md-3">
          <div class="small text-muted">Estado</div>
          <div>${statusBadge(status)}</div>
        </div>
        <div class="col-6 col-md-3">
          <div class="small text-muted">Comprobante</div>
          <div>${proof ? `<a href="${proof}" target="_blank" rel="noopener noreferrer">Abrir</a>` : "—"}</div>
        </div>
      </div>
    `;
  }

  if ($.modalJson) $.modalJson.textContent = JSON.stringify(s, null, 2);

  const st = norm(status);
  const canDecide = st === "pending";
  if ($.btnApprove) $.btnApprove.disabled = _busy || !canDecide;
  if ($.btnReject) $.btnReject.disabled = _busy || !canDecide;

  $.modal?.show();
  if (opts.keepOpen !== true) return;
}

/* =========================
   Events
========================= */
function bindEvents() {
  $.logoutBtn?.addEventListener("click", logout);

  $.btnRefresh?.addEventListener("click", loadSubmissions);
  $.searchInput?.addEventListener("input", render);
  $.seasonFilter?.addEventListener("change", render);
  $.statusFilter?.addEventListener("change", render);

  $.tbody?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "view") openView(btn.dataset.id);
  });

  $.btnApprove?.addEventListener("click", async () => {
    if (!currentSub) return;
    await applyDecision(currentSub, "validated");
  });

  $.btnReject?.addEventListener("click", async () => {
    if (!currentSub) return;
    await applyDecision(currentSub, "rejected");
  });

  $.btnSaveNote?.addEventListener("click", async () => {
    if (!currentSub) return;
    await saveAdminNoteOnly(currentSub);
  });

  $.modalEl?.addEventListener("hidden.bs.modal", () => {
    currentSub = null;
    if ($.adminNoteInput) $.adminNoteInput.value = "";
    setBusy(false);
  });
}

/* =========================
   Public API
========================= */
export async function mount(container) {
  allSubs = [];
  currentSub = null;
  $ = {};
  _busy = false;

  renderShell(container);
  cacheDom(container);
  bindEvents();

  watchAuth(async (user) => {
    if (!user) return;
    await loadSubmissions();
  });
}
