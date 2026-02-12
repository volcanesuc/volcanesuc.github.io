// js/features/payments_admin.js
// Admin tab: lista "membership_payment_submissions" y cruza con memberships/associates si puede.

import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Collections
========================= */
const COL_SUBMISSIONS = "membership_payment_submissions";
const COL_MEMBERSHIPS = "memberships";
const COL_ASSOCIATES = "associates";

// cuántos submissions cargar
const DEFAULT_LIMIT = 300;

/* =========================
   State
========================= */
let $ = {};
let allSubs = [];
let associatesById = new Map();
let membershipsById = new Map();

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

/* =========================
   Shell
========================= */
function renderShell(container) {
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
      <div class="text-muted small">Pagos enviados (membership_payment_submissions)</div>
      <div class="d-flex gap-2">
        <button id="btnRefresh" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-arrow-clockwise me-1"></i> Refrescar
        </button>
      </div>
    </div>

    <div class="row g-2">
      <div class="col-12 col-md-5">
        <input id="searchInput" class="form-control" placeholder="Buscar por nombre, ref, membershipId..." />
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
          <option value="paid">Pagado</option>
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
            <th style="width:160px;">Fecha</th>
            <th>Asociado</th>
            <th>Membresía</th>
            <th>Estado</th>
            <th>Ref</th>
            <th>Monto</th>
            <th class="text-end">Ver</th>
          </tr>
        </thead>
        <tbody id="subsTbody">
          <tr><td colspan="7" class="text-muted">Cargando…</td></tr>
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
          <pre id="submissionJson" class="small bg-light p-2 rounded" style="white-space:pre-wrap;"></pre>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cerrar</button>
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
  $.modalJson = root.querySelector("#submissionJson");
}

/* =========================
   Data loading
========================= */
async function preloadLookups() {
  // Para mostrar nombre del asociado y temporada/monto esperado de la membresía.
  const [assSnap, memSnap] = await Promise.all([
    getDocs(collection(db, COL_ASSOCIATES)),
    getDocs(collection(db, COL_MEMBERSHIPS)),
  ]);

  associatesById = new Map(assSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  membershipsById = new Map(memSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
}

async function loadSubmissions() {
  showLoader?.("Cargando pagos…");

  // Intentamos orderBy createdAt; si tu colección no tiene ese campo,
  // quitalo y deja getDocs(collection(...)) simple.
  let snap;
  try {
    const q = query(collection(db, COL_SUBMISSIONS), orderBy("createdAt", "desc"), limit(DEFAULT_LIMIT));
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

function getAssociateName(sub) {
  const aid = pick(sub, ["associateId", "associate_id", "uid", "userId", "playerId"], null);
  const snapName = pick(sub, ["associateName", "fullName", "name"], null);
  if (snapName) return snapName;

  if (aid && associatesById.has(aid)) {
    const a = associatesById.get(aid);
    return a.fullName || a.name || a.email || aid;
  }
  return aid || "—";
}

function getMembershipLabel(sub) {
  const mid = pick(sub, ["membershipId", "membership_id", "mid"], null);
  if (!mid) return "—";

  const m = membershipsById.get(mid);
  const season = m?.season || pick(sub, ["season"], null) || "—";
  return `#${mid} (${season})`;
}

function getSeason(sub) {
  const mid = pick(sub, ["membershipId", "membership_id", "mid"], null);
  const m = mid ? membershipsById.get(mid) : null;
  return m?.season || pick(sub, ["season"], null) || "—";
}

function getAmount(sub) {
  // intenta varios nombres posibles
  return pick(sub, ["amount", "paidAmount", "total", "value", "monto"], null);
}

function getCurrency(sub) {
  return pick(sub, ["currency", "cur"], "CRC");
}

function getRef(sub) {
  return pick(sub, ["ref", "reference", "sinpeRef", "comprobante", "receipt"], "—");
}

function getStatus(sub) {
  return pick(sub, ["status", "state"], "pending");
}

function getCreatedAt(sub) {
  return pick(sub, ["createdAt", "submittedAt", "timestamp", "paidAt", "date"], null);
}

function fillSeasonFilterFromData() {
  if (!$.seasonFilter) return;

  const curr = $.seasonFilter.value || "all";
  const seasons = Array.from(new Set(allSubs.map(getSeason).filter((s) => s && s !== "—")))
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
    list = list.filter((s) => norm(getStatus(s)) === statusVal);
  }

  if (qText) {
    list = list.filter((s) => {
      const blob = [
        s.id,
        getAssociateName(s),
        getMembershipLabel(s),
        getSeason(s),
        getRef(s),
        getStatus(s),
        getAmount(s),
      ]
        .map(norm)
        .join(" ");
      return blob.includes(qText);
    });
  }

  // suma simple (si hay mezcla de monedas, esto es solo guía)
  const sum = list.reduce((acc, s) => acc + (Number(getAmount(s)) || 0), 0);

  $.countLabel.textContent = `${list.length} submissions`;
  $.sumLabel.textContent = `Suma lista: ${fmtMoney(sum, "CRC")}`;

  if (!list.length) {
    $.tbody.innerHTML = `<tr><td colspan="7" class="text-muted">No hay submissions con esos filtros.</td></tr>`;
    return;
  }

  $.tbody.innerHTML = list
    .map((s) => {
      const date = fmtDate(getCreatedAt(s));
      const name = esc(getAssociateName(s));
      const memb = esc(getMembershipLabel(s));
      const st = statusBadge(getStatus(s));
      const ref = esc(getRef(s));
      const amt = fmtMoney(getAmount(s), getCurrency(s));

      return `
        <tr>
          <td style="white-space:nowrap;">${date}</td>
          <td>${name}</td>
          <td class="mono">${memb}</td>
          <td>${st}</td>
          <td class="mono">${ref}</td>
          <td style="white-space:nowrap;">${amt}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" type="button" data-action="view" data-id="${s.id}">
              <i class="bi bi-eye me-1"></i> Ver
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

/* =========================
   Modal detail
========================= */
function openView(id) {
  const s = allSubs.find((x) => x.id === id);
  if (!s) return;

  if ($.modalJson) {
    $.modalJson.textContent = JSON.stringify(s, null, 2);
  }
  $.modal?.show();
}

/* =========================
   Events
========================= */
function bindEvents() {
  $.logoutBtn?.addEventListener("click", logout);

  $.btnRefresh?.addEventListener("click", refreshAll);
  $.searchInput?.addEventListener("input", render);
  $.seasonFilter?.addEventListener("change", render);
  $.statusFilter?.addEventListener("change", render);

  $.tbody?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "view") openView(btn.dataset.id);
  });
}

async function refreshAll() {
  showLoader?.("Cargando…");
  try {
    await preloadLookups();
    await loadSubmissions();
  } finally {
    hideLoader?.();
  }
}

/* =========================
   Public API
========================= */
export async function mount(container, cfg) {
  allSubs = [];
  associatesById = new Map();
  membershipsById = new Map();
  $ = {};

  renderShell(container);
  cacheDom(container);
  bindEvents();

  watchAuth(async (user) => {
    if (!user) return;
    await refreshAll();
  });
}
