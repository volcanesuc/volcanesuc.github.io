// js/features/associates_list.js
import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// NO loadHeader aquí: lo hace association.js o la página standalone

const COL = "associates";

// state
let all = [];
let $ = {};

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
  $.btnRefresh = root.querySelector("#btnRefresh");
}

// ---------- shell ----------
function renderShellForTab(container) {
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2">
      <div>
        <h3 class="h5 mb-1">Asociados</h3>
        <div class="text-muted small">Listado de asociados con filtros y acceso a edición.</div>
      </div>
      <div class="d-flex gap-2">
        <a class="btn btn-primary btn-sm" href="associate_new.html">
          <i class="bi bi-plus-circle me-1"></i> Nuevo
        </a>
        <button id="btnRefresh" class="btn btn-outline-secondary btn-sm" type="button">
          <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
        </button>
      </div>
    </div>

    <div class="row g-2 align-items-end mb-3">
      <div class="col-12 col-md-5">
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

      <div class="col-12 col-md-2">
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
                <th>Estado</th>
                <th class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody id="associatesTbody">
              <tr><td colspan="5" class="text-muted">Cargando…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ---------- data ----------
async function loadAssociates() {
  showLoader?.("Cargando asociados…");
  try {
    const q = query(collection(db, COL), orderBy("fullName", "asc"));
    const snap = await getDocs(q);
    all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  let list = [...all];

  if (typeVal !== "all") {
    list = list.filter((a) => (a.type || "other") === typeVal);
  }

  if (statusVal === "active") {
    list = list.filter((a) => a.active !== false);
  } else if (statusVal === "inactive") {
    list = list.filter((a) => a.active === false);
  }

  if (qText) {
    list = list.filter((a) => {
      const fullName = normalize(a.fullName);
      const email = normalize(a.email);
      const phone = normalize(a.phone);
      return fullName.includes(qText) || email.includes(qText) || phone.includes(qText);
    });
  }

  $.countLabel.textContent = `${list.length} asociado(s)`;

  if (!list.length) {
    $.tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No hay asociados con esos filtros.</td></tr>`;
    return;
  }

  $.tbody.innerHTML = list
    .map((a) => {
      const active = a.active !== false;
      const estado = active ? badge("Activo", "yellow") : badge("Inactivo", "gray");

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
          <td>${estado}</td>
          <td class="text-end">
            <a class="btn btn-sm btn-outline-primary" href="associate_edit.html?aid=${encodeURIComponent(a.id)}">
              <i class="bi bi-pencil me-1"></i> Editar
            </a>
          </td>
        </tr>
      `;
    })
    .join("");
}

// ---------- public API ----------
export async function mount(container, cfg) {
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
  mount(document.body);
})();
