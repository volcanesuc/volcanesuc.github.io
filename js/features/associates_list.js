import { db } from "../firebase.js";
import { watchAuth, logout } from "../auth.js";
import { loadHeader } from "../components/header.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

loadHeader("admin");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

const COL = "associates";

const tbody = document.getElementById("associatesTbody");
const countLabel = document.getElementById("countLabel");

const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const btnRefresh = document.getElementById("btnRefresh");

let all = [];

watchAuth(async (user) => {
  if (!user) return;
  await loadAssociates();
});

function normalize(s){ return (s || "").toString().toLowerCase().trim(); }

function badge(text, cls=""){
  return `<span class="badge-soft ${cls}">${text}</span>`;
}

function typeLabel(t){
  const map = {
    player: "Jugador/a",
    supporter: "Supporter",
    parent: "Encargado/a",
    other: "Otro"
  };
  return map[t] || "—";
}

async function loadAssociates(){
  showLoader?.("Cargando asociados…");

  // single orderBy -> sin índices compuestos
  const q = query(collection(db, COL), orderBy("fullName", "asc"));
  const snap = await getDocs(q);
  all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  render();
  hideLoader?.();
}

function render(){
  const qText = normalize(searchInput.value);
  const typeVal = typeFilter.value;
  const statusVal = statusFilter.value;

  let list = [...all];

  if (typeVal !== "all"){
    list = list.filter(a => (a.type || "other") === typeVal);
  }

  if (statusVal === "active"){
    list = list.filter(a => a.active !== false);
  } else if (statusVal === "inactive"){
    list = list.filter(a => a.active === false);
  }

  if (qText){
    list = list.filter(a => {
      const fullName = normalize(a.fullName);
      const email = normalize(a.email);
      const phone = normalize(a.phone);
      return fullName.includes(qText) || email.includes(qText) || phone.includes(qText);
    });
  }

  countLabel.textContent = `${list.length} asociado(s)`;

  if (!list.length){
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No hay asociados con esos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => {
    const active = a.active !== false;
    const estado = active ? badge("Activo", "yellow") : badge("Inactivo", "gray");

    const contacto = [
      a.email ? `<div>${a.email}</div>` : "",
      a.phone ? `<div class="text-muted small">${a.phone}</div>` : ""
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
          <a class="btn btn-sm btn-outline-primary" href="associate_edit.html?aid=${a.id}">
            <i class="bi bi-pencil me-1"></i> Editar
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

btnRefresh.addEventListener("click", loadAssociates);
searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);
statusFilter.addEventListener("change", render);
