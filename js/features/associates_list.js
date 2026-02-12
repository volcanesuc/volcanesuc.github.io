// js/features/associates_list.js
import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { showLoader, hideLoader } from "../ui/loader.js";
import { openModal } from "../ui/modal_host.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// NO loadHeader aquí: lo hace association.js

const COL_ASSOCIATES = "associates";
const COL_MEMBERSHIPS = "memberships";

// state
let all = [];
let $ = {};
let _cfg = {};

// ---------- helpers ----------
function normalize(s) {
  return (s || "").toString().toLowerCase().trim();
}

function badge(text, cls = "") {
  return `<span class="badge-soft ${cls}">${text}</span>`;
}

function typeLabel(t) {
  const map = {
    player: "Jugador/a",
    supporter: "Supporter",
    parent: "Encargado/a",
    other: "Otro",
  };
  return map[t] || "—";
}

/**
 * Normaliza status de memberships a "estado de asociación" (lo que querés filtrar)
 * - Al día: memberships.status === "validated"
 * - Moroso: NO validated (pending/validating/overdue/etc) y asociado activo
 * - Validando: validating/submitted
 * - Pendiente: pending/created/unpaid/null
 * - Vencido: overdue
 * - Inactivo: associates.active === false
 */
function assocStatusKey(membershipStatus, associateActive = true) {
  if (associateActive === false) return "inactive";

  const s = (membershipStatus || "").toLowerCase();

  if (s === "validated") return "up_to_date";
  if (s === "validating" || s === "submitted") return "validating";
  if (s === "overdue") return "overdue";

  // todo lo demás lo tratamos como pendiente/moroso
  return "pending";
}

function assocBadge(key) {
  // key: up_to_date | pending | validating | overdue | inactive
  if (key === "up_to_date") return badge("Al día", "green");
  if (key === "validating") return badge("Validando", "yellow");
  if (key === "overdue") return badge("Vencido", "red");
  if (key === "inactive") return badge("Inactivo", "gray");
  return badge("Pendiente", "orange");
}

function isMoroso(assocKey, associateActive) {
  // Moroso = activo y no está al día
  return associateActive !== false && assocKey !== "up_to_date";
}

function chunk(arr, size = 10) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cacheDom(root) {
  $.root = root;

  // header logout (global)
  $.logoutBtn = document.getElementById("logoutBtn");

  // local UI
  $.tbody = root.querySelector("#associatesTbody");
  $.countLabel = root.querySelector("#countLabel");

  $.searchInput = root.querySelector("#searchInput");
  $.typeFilter = root.querySelector("#typeFilter");
  $.statusFilter = root.querySelector("#statusFilter");

  // nuevo filtro de asociación
  $.assocFilter = root.querySelector("#associationFilter");

  $.btnRefresh = root.querySelector("#btnRefresh");
  $.btnNewAssociate = root.querySelector("#btnNewAssociate");
}

// ---------- shell (tab dentro de association.html) ----------
function renderShellForTab(container) {
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2">
      <div>
        <div class="text-muted small">Listado de miembros con filtros y acceso a edición.</div>
      </div>
      <div class="d-flex gap-2">
        <button id="btnNewAssociate" class="btn btn-primary btn-sm" type="button">
          <i class="bi bi-plus-lg me-1"></i> Nuevo
        </button>
        <button id="btnRefresh" class="btn btn-outline-secondary btn-sm" type="button">
          <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
        </button>
      </div>
    </div>

    <div class="row g-2 align-items-end mb-3">
      <div class="col-12 col-md-4">
        <label class="form-label mb-1">Buscar</label>
        <input id="searchInput" class="form-control" placeholder="Nombre, email o teléfono…" />
      </div>

      <div class="col-6 col-md-2">
        <label class="form-label mb-1">Tipo</label>
        <select id="typeFilter" class="form-select">
          <option value="all" selected>Todos</option>
          <option value="player">Jugador/a</option>
          <option value="supporter">Supporter</option>
          <option value="parent">Encargado/a</option>
          <option value="other">Otro</option>
        </select>
      </div>

      <div class="col-6 col-md-2">
        <label class="form-label mb-1">Estado (perfil)</label>
        <select id="statusFilter" class="form-select">
          <option value="all" selected>Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <div class="col-6 col-md-3">
        <label class="form-label mb-1">Asociación</label>
        <select id="associationFilter" class="form-select">
          <option value="all" selected>Todos</option>
          <option value="up_to_date">Al día</option>
          <option value="moroso">Morosos</option>
          <option value="pending">Pendiente</option>
          <option value="validating">Validando</option>
          <option value="overdue">Vencido</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      <div class="col-6 col-md-1">
        <div class="text-muted small mb-1">&nbsp;</div>
        <div id="countLabel" class="text-muted small">—</div>
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>Asociado</th>
                <th>Contacto</th>
                <th>Tipo</th>
                <th>Asociación</th>
                <th>Estado</th>
                <th class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody id="associatesTbody">
              <tr><td colspan="6" class="text-muted">Cargando…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ---------- data ----------
async function loadMembershipMapForSeason(season, associateIds) {
  const map = {}; // { [associateId]: membershipDocData }
  const groups = chunk(associateIds.filter(Boolean), 10);

  for (const ids of groups) {
    const q = query(
      collection(db, COL_MEMBERSHIPS),
      where("season", "==", season),
      where("associateId", "in", ids)
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const m = d.data();
      if (m?.associateId) map[m.associateId] = { id: d.id, ...m };
    });
  }

  return map;
}

async function loadAssociates() {
  showLoader?.("Cargando Miembros…");
  try {
    const q = query(collection(db, COL_ASSOCIATES), orderBy("fullName", "asc"));
    const snap = await getDocs(q);
    const associates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // temporada (si association.js te pasa cfg.season, perfecto)
    const season = (_cfg?.season || new Date().getFullYear().toString());
    const ids = associates.map((a) => a.id);

    const membershipMap = await loadMembershipMapForSeason(season, ids);

    all = associates.map((a) => {
      const isActive = a.active !== false;
      const membership = membershipMap[a.id] || null;
      const aKey = assocStatusKey(membership?.status, isActive);

      return {
        ...a,
        membership,
        _season: season,
        _assocKey: aKey, // up_to_date | pending | validating | overdue | inactive
        _isMoroso: isMoroso(aKey, isActive),
      };
    });

    render();
  } finally {
    hideLoader?.();
  }
}

function render() {
  if (!$.tbody || !$.countLabel) return;

  const qText = normalize($.searchInput?.value);
  const typeVal = $.typeFilter?.value || "all";
  const statusVal = $.statusFilter?.value || "all";
  const assocVal = $.assocFilter?.value || "all";

  let list = [...all];

  // tipo
  if (typeVal !== "all") {
    list = list.filter((a) => (a.type || "other") === typeVal);
  }

  // estado del perfil (activo/inactivo)
  if (statusVal === "active") {
    list = list.filter((a) => a.active !== false);
  } else if (statusVal === "inactive") {
    list = list.filter((a) => a.active === false);
  }

  // filtro asociación (al día / morosos / pendiente / validando / vencido / inactivo)
  if (assocVal !== "all") {
    if (assocVal === "moroso") {
      list = list.filter((a) => a._isMoroso);
    } else {
      list = list.filter((a) => a._assocKey === assocVal);
    }
  }

  // búsqueda (nombre/email/teléfono)
  if (qText) {
    list = list.filter((a) => {
      const fullName = normalize(a.fullName);
      const email = normalize(a.email);
      const phone = normalize(a.phone);
      return fullName.includes(qText) || email.includes(qText) || phone.includes(qText);
    });
  }

  $.countLabel.textContent = `${list.length}`;

  if (!list.length) {
    $.tbody.innerHTML = `<tr><td colspan="6" class="text-muted">No hay miembros con esos filtros.</td></tr>`;
    return;
  }

  $.tbody.innerHTML = list
    .map((a) => {
      const isActive = a.active !== false;

      // Perfil (activo/inactivo)
      const estado = isActive ? badge("Activo", "yellow") : badge("Inactivo", "gray");

      // Asociación (según memberships.status para la season)
      const aBadge = assocBadge(a._assocKey);

      const contacto = [
        a.email ? `<div>${a.email}</div>` : "",
        a.phone ? `<div class="text-muted small">${a.phone}</div>` : "",
      ].join("");

      return `
        <tr>
          <td>
            <div class="fw-bold">${a.fullName || "—"}</div>
            ${a.idNumber ? `<div class="text-muted small">Cédula: ${a.idNumber}</div>` : ""}
          </td>
          <td>${contacto || `<span class="text-muted">—</span>`}</td>
          <td>${typeLabel(a.type)}</td>
          <td>${aBadge}</td>
          <td>${estado}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary btnEdit" data-id="${a.id}" type="button">
              <i class="bi bi-pencil me-1"></i> Editar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  $.root.querySelectorAll(".btnEdit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      openModal(`associate_modal.html?aid=${encodeURIComponent(id)}`);
    });
  });
}

// ---------- public API ----------
export async function mount(container, cfg) {
  _cfg = cfg || {};

  // Siempre estamos como tab dentro de association.html.
  // Render shell si el contenedor no trae ya la tabla.
  const hasTableAlready = !!container?.querySelector?.("#associatesTbody");
  if (!hasTableAlready) {
    renderShellForTab(container);
  }

  cacheDom(container);

  // logout (si existe en header global)
  $.logoutBtn?.addEventListener("click", logout);

  // listeners
  $.btnRefresh?.addEventListener("click", loadAssociates);
  $.searchInput?.addEventListener("input", render);
  $.typeFilter?.addEventListener("change", render);
  $.statusFilter?.addEventListener("change", render);
  $.assocFilter?.addEventListener("change", render);

  $.btnNewAssociate?.addEventListener("click", () => {
    openModal(`associate_modal.html`);
  });

  watchAuth(async (user) => {
    if (!user) return;
    await loadAssociates();
  });
}
