// js/tournament_roster.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS } from "./strings.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ==========================
   HEADER / AUTH
========================== */
loadHeader("tournaments");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

const S = TOURNAMENT_STRINGS;

/* ==========================
   DOM
========================== */
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

/* ==========================
   PARAMS / STATE
========================== */
const params = new URLSearchParams(window.location.search);
const tournamentId = (params.get("id") || "").trim();

let tournament = null;
let roster = [];   // roster entries
let players = [];  // club players
let addPanelVisible = true;

/* ==========================
   COLLECTIONS FROM CONFIG
========================== */
const TOURNAMENTS_COL = APP_CONFIG?.club?.tournamentsCollection || "tournaments";
const PLAYERS_COL = APP_CONFIG?.club?.playersCollection || "club_players";

/* ==========================
   STRINGS -> UI
========================== */
applyStrings();

/* ==========================
   EVENTS
========================== */
searchInput?.addEventListener("input", render);
playersSearch?.addEventListener("input", renderPlayers);

openAddBtn?.addEventListener("click", () => {
  addPanelVisible = !addPanelVisible;
  if (playersList) playersList.style.display = addPanelVisible ? "" : "none";
  if (playersSearch) playersSearch.style.display = addPanelVisible ? "" : "none";
});

/* ==========================
   INIT
========================== */
watchAuth(async () => {
  showLoader();
  try {
    if (appVersion) appVersion.textContent = `v${APP_CONFIG.version}`;

    if (!tournamentId) {
      showError("Falta el parámetro del torneo. Ej: tournament_roster.html?id=XXXX");
      return;
    }

    tournament = await fetchTournament(tournamentId);
    if (!tournament) {
      showError("No se encontró el torneo.");
      return;
    }

    if (detailBtn) {
      detailBtn.href = `tournament_detail.html?id=${encodeURIComponent(tournamentId)}`;
    }

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

/* ==========================
   DATA
========================== */
async function fetchTournament(id) {
  const snap = await getDoc(doc(db, TOURNAMENTS_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function loadRoster() {
  const snap = await getDocs(collection(db, TOURNAMENTS_COL, tournamentId, "roster"));
  roster = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
}

async function loadPlayers() {
  const snap = await getDocs(collection(db, PLAYERS_COL));

  players = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .map(p => ({
      ...p,
      // normalizamos name por si lo tenés como "nombre" u otro
      name: p.name || p.fullName || p.displayName || p.nombre || ""
    }))
    .filter(p => (p.name || "").trim().length > 0)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  console.log("Players loaded:", players.length, `source: ${PLAYERS_COL}`);

  if (playersSubtitle) {
    playersSubtitle.textContent =
      players.length
        ? `Fuente: ${PLAYERS_COL} · ${players.length} jugador(es)`
        : `No hay jugadores en ${PLAYERS_COL}.`;
  }
}

/* ==========================
   RENDER: ROSTER
========================== */
function render() {
  if (!tournament) return;

  // header
  if (tName) tName.textContent = tournament.name || "—";
  if (tMeta) tMeta.textContent = formatTournamentMeta(tournament);

  const q = (searchInput?.value || "").trim().toLowerCase();
  const list = q
    ? roster.filter(r =>
        `${r.name || ""} ${r.role || ""} ${r.status || ""}`.toLowerCase().includes(q)
      )
    : roster;

  if (rosterList) {
    rosterList.innerHTML = list.length ? list.map(r => rosterRow(r)).join("") : "";
  }

  if (rosterEmpty) {
    rosterEmpty.classList.toggle("d-none", list.length > 0);
    rosterEmpty.textContent = S.roster?.empty || "No hay jugadores asignados a este torneo.";
  }

  // listeners
  rosterList?.querySelectorAll("[data-remove]")?.forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-remove");
      await removeFromRoster(id);
    });
  });

  rosterList?.querySelectorAll("[data-toggle-status]")?.forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle-status");
      await toggleStatus(id);
    });
  });
}

/* ==========================
   RENDER: PLAYERS PICKER
========================== */
function renderPlayers() {
  const q = (playersSearch?.value || "").trim().toLowerCase();
  const rosterIds = new Set(roster.map(r => r.playerId || r.id));

  const list = q
    ? players.filter(p =>
        `${p.name || ""} ${p.nickname || ""}`.toLowerCase().includes(q)
      )
    : players;

  if (playersList) {
    playersList.innerHTML = list.length
      ? list.map(p => playerPickRow(p, rosterIds.has(p.id))).join("")
      : "";
  }

  if (playersEmpty) {
    playersEmpty.classList.toggle("d-none", list.length > 0);
  }

  playersList?.querySelectorAll("[data-add]")?.forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-add");
      await addToRoster(id);
    });
  });
}

/* ==========================
   ACTIONS
========================== */
async function addToRoster(playerId) {
  const p = players.find(x => x.id === playerId);
  if (!p) return;

  showLoader();
  try {
    // usamos playerId como docId => idempotente
    const ref = doc(db, TOURNAMENTS_COL, tournamentId, "roster", playerId);

    await setDoc(ref, {
      playerId,
      name: p.name || "—",
      number: p.number ?? null,
      role: p.role || "",
      status: "convocado",
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
    await deleteDoc(doc(db, TOURNAMENTS_COL, tournamentId, "roster", playerIdOrDocId));
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
  const r = roster.find(x => x.id === playerIdOrDocId);
  if (!r) return;

  const next = nextStatus(r.status);

  showLoader();
  try {
    await setDoc(doc(db, TOURNAMENTS_COL, tournamentId, "roster", playerIdOrDocId), {
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

/* ==========================
   UI BUILDERS
========================== */
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

/* ==========================
   STRINGS
========================== */
function applyStrings() {
  pageTitle && (pageTitle.textContent = S.roster?.title || "Roster del torneo");
  pageSubtitle && (pageSubtitle.textContent = S.roster?.subtitle || "Jugadores convocados");

  rosterTitle && (rosterTitle.textContent = S.roster?.title || "Roster del torneo");
  rosterSubtitle && (rosterSubtitle.textContent = S.roster?.subtitle || "Jugadores convocados");

  lblSearch && (lblSearch.textContent = S.search?.label || "Buscar");
  searchInput && (searchInput.placeholder = S.search?.placeholder || "Buscar jugador…");

  playersTitle && (playersTitle.textContent = "Jugadores");
  btnAddLabel && (btnAddLabel.textContent = "Agregar jugador");
}

/* ==========================
   HELPERS
========================== */
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
