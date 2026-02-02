// js/tournament_roster.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS, CLUB_DATA } from "./strings.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

loadHeader("tournaments");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

const S = TOURNAMENT_STRINGS;

// ---- DOM
const appVersion = document.getElementById("appVersion");

const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const tName = document.getElementById("tName");
const tMeta = document.getElementById("tMeta");
const detailBtn = document.getElementById("detailBtn");

const errorBox = document.getElementById("errorBox");

const lblSearch = document.getElementById("lblSearch");
const searchInput = document.getElementById("searchInput");
const openAddBtn = document.getElementById("openAddBtn");
const btnAddLabel = document.getElementById("btnAddLabel");

const rosterTitle = document.getElementById("rosterTitle");
const rosterSubtitle = document.getElementById("rosterSubtitle");
const rosterList = document.getElementById("rosterList");
const rosterEmpty = document.getElementById("rosterEmpty");

const playersSearch = document.getElementById("playersSearch");
const playersList = document.getElementById("playersList");
const playersEmpty = document.getElementById("playersEmpty");

const playersTitle = document.getElementById("playersTitle");
const playersSubtitle = document.getElementById("playersSubtitle");

// ---- Params
const params = new URLSearchParams(window.location.search);
const tournamentId = (params.get("id") || "").trim();

// ---- State
let tournament = null;
let roster = [];   // roster entries
let players = [];  // global players
let addPanelVisible = true;

// ---- Strings to UI
applyStrings();

// ---- Events
searchInput?.addEventListener("input", render);
playersSearch?.addEventListener("input", renderPlayers);
openAddBtn?.addEventListener("click", () => {
  addPanelVisible = !addPanelVisible;
  playersList.style.display = addPanelVisible ? "" : "none";
  playersSearch.style.display = addPanelVisible ? "" : "none";
});

// ---- Init
watchAuth(async () => {
  showLoader();
  try {
    appVersion && (appVersion.textContent = `v${APP_CONFIG.version}`);

    if (!tournamentId) {
      showError("Falta el parámetro del torneo. Ej: tournament_roster.html?id=XXXX");
      return;
    }

    tournament = await fetchTournament(tournamentId);
    if (!tournament) {
      showError("No se encontró el torneo.");
      return;
    }

    detailBtn && (detailBtn.href = `tournament_detail.html?id=${encodeURIComponent(tournamentId)}`);

    // Load roster + players
    await Promise.all([loadRoster(), loadPlayers()]);
    render();
    renderPlayers();
  } catch (e) {
    console.error(e);
    showError("Error cargando roster del torneo.");
  } finally {
    hideLoader();
  }
});

// ---- Data
async function fetchTournament(id) {
  const snap = await getDoc(doc(db, "tournaments", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function loadRoster() {
  const snap = await getDocs(collection(db, "tournaments", tournamentId, "roster"));
  roster = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

async function loadPlayers() {
  // Rutas posibles (escalable). Se usa la primera que tenga docs.
  const clubId = CLUB_DATA?.club?.id || "volcanes";

  const candidates = [
    { label: "players", ref: collection(db, "players") },
    { label: "roster", ref: collection(db, "roster") },
    { label: `clubs/${clubId}/players`, ref: collection(db, "clubs", clubId, "players") },
    { label: `clubs/${clubId}/roster`, ref: collection(db, "clubs", clubId, "roster") }
  ];

  let found = [];
  let source = null;

  for (const c of candidates) {
    try {
      const snap = await getDocs(c.ref);
      if (!snap.empty) {
        found = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        source = c.label;
        break;
      }
    } catch (e) {
      // si rules bloquean o la ruta no existe, seguimos con la siguiente
      console.warn("No se pudo leer:", c.label, e?.message || e);
    }
  }

  players = (found || [])
    .map(p => ({
      ...p,
      // normalizamos name por si lo tenés como fullName o displayName
      name: p.name || p.fullName || p.displayName || ""
    }))
    .filter(p => (p.name || "").trim().length > 0)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  // Debug visible (opcional)
  console.log("Players loaded:", players.length, "source:", source);

  // Si querés, mostramos de dónde viene
  if (playersSubtitle) {
    playersSubtitle.textContent =
      players.length
        ? `Fuente: ${source} · ${players.length} jugador(es)`
        : `No se encontraron jugadores (revisar colección / permisos)`;
  }
}


// ---- Render main roster
function render() {
  if (!tournament) return;

  // header
  tName.textContent = tournament.name || "—";
  tMeta.textContent = formatTournamentMeta(tournament);

  const q = (searchInput?.value || "").trim().toLowerCase();
  const list = q
    ? roster.filter(r => `${r.name || ""} ${r.role || ""} ${r.status || ""}`.toLowerCase().includes(q))
    : roster;

  rosterList.innerHTML = list.length
    ? list.map(r => rosterRow(r)).join("")
    : "";

  rosterEmpty.classList.toggle("d-none", list.length > 0);
  rosterEmpty.textContent = S.roster?.empty || "No hay jugadores asignados a este torneo.";

  // listeners remove / quick edit
  rosterList.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-remove");
      await removeFromRoster(id);
    });
  });

  rosterList.querySelectorAll("[data-toggle-status]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle-status");
      await toggleStatus(id);
    });
  });
}

// ---- Render players picker
function renderPlayers() {
  const q = (playersSearch?.value || "").trim().toLowerCase();
  const rosterIds = new Set(roster.map(r => r.playerId || r.id));

  const list = q
    ? players.filter(p => `${p.name || ""} ${p.nickname || ""}`.toLowerCase().includes(q))
    : players;

  // show all players but disable those already in roster
  playersList.innerHTML = list.length
    ? list.map(p => playerPickRow(p, rosterIds.has(p.id))).join("")
    : "";

  playersEmpty.classList.toggle("d-none", list.length > 0);

  playersList.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-add");
      await addToRoster(id);
    });
  });
}

// ---- Actions
async function addToRoster(playerId) {
  const p = players.find(x => x.id === playerId);
  if (!p) return;

  showLoader();
  try {
    // Use playerId as doc id for idempotency
    const ref = doc(db, "tournaments", tournamentId, "roster", playerId);

    await setDoc(ref, {
      playerId,
      name: p.name || "—",
      number: p.number ?? null,
      role: p.role || "",
      status: "convocado", // default (puedes cambiar luego)
      createdAt: serverTimestamp()
    }, { merge: true });

    await loadRoster();
    render();
    renderPlayers();
  } catch (e) {
    console.error(e);
    alert("Error agregando jugador al roster.");
  } finally {
    hideLoader();
  }
}

async function removeFromRoster(playerIdOrDocId) {
  const ok = confirm("¿Quitar del roster?");
  if (!ok) return;

  showLoader();
  try {
    await deleteDoc(doc(db, "tournaments", tournamentId, "roster", playerIdOrDocId));
    await loadRoster();
    render();
    renderPlayers();
  } catch (e) {
    console.error(e);
    alert("Error quitando jugador.");
  } finally {
    hideLoader();
  }
}

async function toggleStatus(playerIdOrDocId) {
  // ciclo simple: convocado -> confirmado -> tentative -> convocado
  const r = roster.find(x => x.id === playerIdOrDocId);
  if (!r) return;

  const next = nextStatus(r.status);
  showLoader();
  try {
    await setDoc(doc(db, "tournaments", tournamentId, "roster", playerIdOrDocId), {
      status: next,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await loadRoster();
    render();
    renderPlayers();
  } catch (e) {
    console.error(e);
    alert("Error actualizando estado.");
  } finally {
    hideLoader();
  }
}

function nextStatus(s) {
  const v = (s || "").toLowerCase();
  if (v === "convocado") return "confirmado";
  if (v === "confirmado") return "tentative";
  return "convocado";
}

// ---- UI builders
function rosterRow(r) {
  const role = r.role || "—";
  const status = prettyStatus(r.status);

  const statusClass = status === "Confirmado" ? "pill pill--yellow" : "pill";

  return `
    <div class="roster-row">
      <div class="roster-row__top">
        <div>
          <div class="roster-row__name">${escapeHtml(r.name || "—")}</div>
          <div class="roster-row__meta">
            ${escapeHtml(role)}
            ${r.number != null ? ` · #${escapeHtml(r.number)}` : ""}
          </div>
        </div>

        <div class="roster-row__actions">
          <button class="btn btn-sm btn-outline-secondary"
                  title="Cambiar estado"
                  data-toggle-status="${escapeHtml(r.id)}">
            <i class="bi bi-arrow-repeat"></i>
          </button>

          <button class="btn btn-sm btn-outline-danger"
                  title="Quitar"
                  data-remove="${escapeHtml(r.id)}">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <div class="roster-row__badges">
        <span class="${statusClass}">${escapeHtml(status)}</span>
      </div>
    </div>
  `;
}

function playerPickRow(p, already) {
  const sub = p.nickname ? `${p.nickname}` : (p.role || "");
  const disabled = already ? "disabled" : "";

  return `
    <div class="player-pick">
      <div>
        <div class="player-pick__name">${escapeHtml(p.name || "—")}</div>
        <div class="player-pick__sub">${escapeHtml(sub || "")}</div>
      </div>

      <button class="btn btn-sm ${already ? "btn-outline-secondary" : "btn-primary"}"
              ${disabled}
              data-add="${escapeHtml(p.id)}"
              title="${already ? "Ya está en el roster" : "Agregar"}">
        <i class="bi ${already ? "bi-check2" : "bi-plus-lg"}"></i>
      </button>
    </div>
  `;
}

// ---- Strings
function applyStrings() {
  pageTitle && (pageTitle.textContent = S.roster?.title || "Roster del torneo");
  pageSubtitle && (pageSubtitle.textContent = S.roster?.subtitle || "Jugadores convocados");

  rosterTitle && (rosterTitle.textContent = S.roster?.title || "Roster del torneo");
  rosterSubtitle && (rosterSubtitle.textContent = S.roster?.subtitle || "Jugadores convocados");

  lblSearch && (lblSearch.textContent = S.search?.label || "Buscar");
  searchInput && (searchInput.placeholder = S.search?.placeholder || "Buscar jugador…");

  btnAddLabel && (btnAddLabel.textContent = "Agregar jugador");
}

// ---- Helpers
function prettyStatus(s) {
  const v = (s || "").toLowerCase();
  if (v === "confirmado") return "Confirmado";
  if (v === "tentative") return "Por confirmar";
  if (v === "convocado") return "Convocado";
  return s || "—";
}

function formatTournamentMeta(t) {
  const start = t.dateStart || "—";
  const end = t.dateEnd || "";
  const where = t.location || "—";
  return end ? `${start} → ${end} · ${where}` : `${start} · ${where}`;
}

function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.remove("d-none");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
