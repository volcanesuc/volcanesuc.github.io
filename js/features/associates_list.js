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

// NO loadHeader aquí: lo hace association.js o la página standalone

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

// memberships.status -> UI badge
function membershipInfo(status, associateActive = true) {
  if (associateActive === false) return { text: "Inactivo", cls: "gray", key: "inactive" };

  const s = (status || "").toLowerCase();

  // tu caso real en Firestore: "validated"
  if (s === "validated") return { text: "Al día", cls: "green", key: "validated" };

  // posibles variantes
  if (s === "validating" || s === "submitted") return { text: "Validando", cls: "yellow", key: "validating" };
  if (s === "overdue") return { text: "Vencido", cls: "red", key: "overdue" };

  // pending/created/unpaid/empty/unknown
  return { text: "Pendiente", cls: "orange", key: "pending" };
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
  $.membershipFilter = root.querySelector("#membershipFilter");

  $.btnRefresh = root.querySelector("#btnRefresh");
  $.btnNewAssociate = root.querySelector("#btnNewAssociate");
}

// ---------- shell (cuando es tab dentro de association.html) ----------
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

      <div class="col-6 col-md-3">
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
        <label class="form-label mb-1">Estado</label>
        <select id="statusFilter" class="form-select">
          <option value="all" selected>Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <div class="col-6 col-md-2">
        <label class="form-label mb-1">Asociación</label>
        <select id="membershipFilter" class="form-select">
          <option value="all" selected>Todos</option>
          <option value="validated">Al día</option>
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

    const season = (_cfg?.season || new Date().getFullYear().toString());
    const ids = associates.map((a) => a.id);

    const membershipMap = await loadMembershipMapForSeason(season, ids);

    all = associates.map((a) => ({
      ...a,
      membership: membershipMap[a.id] || null,
      _season: season,
    }));

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
  const membershipVal = $.membershipFilter?.value || "all";

  let list = [...all];

  // tipo
  if (typeVal !== "all") {
    list = list.filter((a) => (a.type || "other") === typeVal);
  }

  // estado (activo/inactivo del asociado)
  if (statusVal === "active") {
    list = list.filter((a) => a.active !== false);
  } else if (statusVal === "inactive") {
    list = list.filter((a) => a.active === false);
  }

  // estado de asociación (membership)
  if (membershipVal !== "all") {
    list = list.filter((a) => {
      const info = membershipInfo(a.membership?.status, a.active !== false);
      return info.key === membershipVal;
    });
  }

  // búsqueda
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
      const estado = isActive ? badge("Activo", "yellow") : badge("Inactivo", "gray");

      const mInfo = membershipInfo(a.membership?.status, isActive);
      const mBadge = badge(mInfo.text, mInfo.cls);

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
          <td>${mBadge}</td>
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

  // Si estamos dentro de association tab: renderizamos el shell
  // Si es standalone: no tocamos el HTML (ya existe)
  const isAssociationTab =
    window.location.pathname.endsWith("/association.html") || container?.dataset?.mount === "true";

  if (isAssociationTab) {
    renderShellForTab(container);
  }

  cacheDom(isAssociationTab ? container : document);

  // logout (si existe en header global)
  $.logoutBtn?.addEventListener("click", logout);

  // listeners
  $.btnRefresh?.addEventListener("click", loadAssociates);
  $.searchInput?.addEventListener("input", render);
  $.typeFilter?.addEventListener("change", render);
  $.statusFilter?.addEventListener("change", render);
  $.membershipFilter?.addEventListener("change", render);

  $.btnNewAssociate?.addEventListener("click", () => {
    openModal(`associate_modal.html`);
  });

  watchAuth(async (user) => {
    if (!user) return;
    await loadAssociates();
  });
}

/* ---------- standalone auto-run ----------
   Si abrís associates.html (o la página que tenga estos IDs),
   va a funcionar sin association tabs.
*/
(function autoRunStandalone() {
  // Si existe el tbody esperado en el documento, asumimos standalone.
  const exists = document.getElementById("associatesTbody");
  if (!exists) return;

  // Monta usando document como root (no re-render shell)
  mount(document.body, {});
})();
