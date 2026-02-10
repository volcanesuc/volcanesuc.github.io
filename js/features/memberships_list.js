import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { loadHeader } from "../components/header.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

loadHeader("admin");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

/* =========================
   Collections
========================= */
const COL_MEMBERSHIPS = "memberships";
const COL_PLANS = "subscription_plans";

/* =========================
   DOM
========================= */
const tbody = document.getElementById("membershipsTbody");
const countLabel = document.getElementById("countLabel");

const searchInput = document.getElementById("searchInput");
const seasonFilter = document.getElementById("seasonFilter");
const planFilter = document.getElementById("planFilter");
const statusFilter = document.getElementById("statusFilter");
const actionFilter = document.getElementById("actionFilter");
const btnRefresh = document.getElementById("btnRefresh");

const kpiPending = document.getElementById("kpiPending");
const kpiPartial = document.getElementById("kpiPartial");
const kpiPaid = document.getElementById("kpiPaid");
const kpiValidated = document.getElementById("kpiValidated");

/* =========================
   State
========================= */
let allMemberships = [];
let allPlans = [];

/* =========================
   Helpers
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
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
  return badge("Pendiente", "gray");
}

function payUrl(mid, code) {
  const base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]+$/, "/")}`;
  return `${base}membership_pay.html?mid=${encodeURIComponent(mid)}&code=${encodeURIComponent(code || "")}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("✅ Link copiado");
  } catch {
    prompt("Copiá el link:", text);
  }
}

function renderKpis() {
  const counts = { pending: 0, partial: 0, paid: 0, validated: 0 };

  for (const m of allMemberships) {
    const st = (m.status || "pending").toLowerCase();
    if (st === "pending") counts.pending++;
    else if (st === "partial") counts.partial++;
    else if (st === "paid") counts.paid++;
    else if (st === "validated") counts.validated++;
  }

  if (kpiPending) kpiPending.textContent = counts.pending;
  if (kpiPartial) kpiPartial.textContent = counts.partial;
  if (kpiPaid) kpiPaid.textContent = counts.paid;
  if (kpiValidated) kpiValidated.textContent = counts.validated;
}

/* =========================
   Boot
========================= */
watchAuth(async (user) => {
  if (!user) return;
  await refreshAll();
});

btnRefresh?.addEventListener("click", refreshAll);
searchInput?.addEventListener("input", render);
seasonFilter?.addEventListener("change", render);
planFilter?.addEventListener("change", render);
statusFilter?.addEventListener("change", render);
actionFilter?.addEventListener("change", render);

tbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const mid = btn.dataset.mid;
  const code = btn.dataset.code || "";

  if (action === "detail") {
    window.location.href = `membership_detail.html?mid=${encodeURIComponent(mid)}`;
    return;
  }

  if (action === "copyPayLink") {
    await copyToClipboard(payUrl(mid, code));
    return;
  }

  if (action === "openPayLink") {
    window.open(payUrl(mid, code), "_blank", "noopener,noreferrer");
  }
});

/* =========================
   Load
========================= */
async function refreshAll() {
  showLoader?.("Cargando membresías…");
  try {
    await Promise.all([loadPlans(), loadMemberships()]);
    fillPlanFilter();
    renderKpis();
    render();
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error cargando datos.</td></tr>`;
  } finally {
    hideLoader?.();
  }
}

async function loadPlans() {
  const snap = await getDocs(collection(db, COL_PLANS));
  allPlans = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.archived)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
}

async function loadMemberships() {
  const snap = await getDocs(collection(db, COL_MEMBERSHIPS));
  allMemberships = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
}

function fillPlanFilter() {
  const curr = planFilter.value || "all";

  const opts = [`<option value="all">Todos</option>`].concat(
    allPlans.map((p) => `<option value="${p.id}">${p.name || "—"}</option>`)
  );

  planFilter.innerHTML = opts.join("");

  const exists = [...planFilter.options].some((o) => o.value === curr);
  planFilter.value = exists ? curr : "all";
}

/* =========================
   Render
========================= */
function render() {
  const qText = norm(searchInput.value);
  const seasonVal = seasonFilter.value || "all";
  const planVal = planFilter.value || "all";
  const statusVal = statusFilter.value || "all";
  const actionVal = actionFilter?.value || "all";

  let list = [...allMemberships];

  // season
  if (seasonVal !== "all") {
    list = list.filter((m) => (m.season || "all") === seasonVal);
  }

  // plan
  if (planVal !== "all") {
    list = list.filter((m) => (m.planId || m.planSnapshot?.id) === planVal);
  }

  // status
  if (statusVal !== "all") {
    list = list.filter((m) => (m.status || "pending").toLowerCase() === statusVal);
  }

  // action
  if (actionVal === "needs_action") {
    list = list.filter((m) => {
      const st = (m.status || "pending").toLowerCase();
      return st === "pending" || st === "partial";
    });
  } else if (actionVal === "ok") {
    list = list.filter((m) => {
      const st = (m.status || "pending").toLowerCase();
      return st === "paid" || st === "validated";
    });
  }

  // search
  if (qText) {
    list = list.filter((m) => {
      const a = m.associateSnapshot || {};
      const p = m.planSnapshot || {};
      const blob = [
        m.id,
        m.season,
        a.fullName,
        a.email,
        a.phone,
        p.name
      ].map(norm).join(" ");
      return blob.includes(qText);
    });
  }

  countLabel.textContent = `${list.length} membresía(s)`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">No hay resultados con esos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((m) => {
    const a = m.associateSnapshot || {};
    const p = m.planSnapshot || {};
    const cur = m.currency || p.currency || "CRC";

    const associateCell = `
      <div class="fw-bold tight">${a.fullName || "—"}</div>
      <div class="small text-muted tight">
        ${[a.email || null, a.phone || null].filter(Boolean).join(" • ") || "—"}
      </div>
      <div class="small text-muted mono tight">ID: ${m.id}</div>
    `;

    const planCell = `
      <div class="fw-bold tight">${p.name || "—"}</div>
      <div class="small text-muted tight">
        ${(p.allowPartial ? "Cuotas" : "Pago único")} • ${p.requiresValidation ? "Validación" : "Sin validación"}
      </div>
    `;

    const amountTxt = p.allowCustomAmount
      ? "Editable"
      : fmtMoney(m.totalAmount ?? p.totalAmount, cur);

    const actions = `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-primary" data-action="detail" data-mid="${m.id}">
          <i class="bi bi-eye me-1"></i> Detalle
        </button>
        <button class="btn btn-outline-dark" data-action="copyPayLink" data-mid="${m.id}" data-code="${m.payCode || ""}">
          <i class="bi bi-clipboard me-1"></i> Link
        </button>
        <button class="btn btn-outline-secondary" data-action="openPayLink" data-mid="${m.id}" data-code="${m.payCode || ""}">
          <i class="bi bi-box-arrow-up-right"></i>
        </button>
      </div>
    `;

    return `
      <tr>
        <td>${associateCell}</td>
        <td>${planCell}</td>
        <td><span class="mono">${m.season || "—"}</span></td>
        <td style="white-space:nowrap;">${amountTxt}</td>
        <td>${statusBadgeHtml(m.status)}</td>
        <td class="text-end">${actions}</td>
      </tr>
    `;
  }).join("");
}
