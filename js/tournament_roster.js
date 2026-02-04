// js/tournament_roster.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS } from "./strings.js";
import { Player } from "./models/player.js";
import { createTournamentEditor } from "./features/tournament_editor.js";

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
   COLLECTIONS FROM CONFIG
========================== */
const TOURNAMENTS_COL = APP_CONFIG?.club?.tournamentsCollection || "tournaments";
const PLAYERS_COL = APP_CONFIG?.club?.playersCollection || "club_players";
const GUESTS_COL = APP_CONFIG?.club?.guestsCollection || "guest_players";

/* ==========================
   TOURNAMENT EDITOR (modal)
   Requiere que tournament_roster.html tenga el mismo modal:
   #tournamentModal + #tournamentForm + campos ids
========================== */
const editor = createTournamentEditor();

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

// Team fee UI (hero)
const teamFeePill = document.getElementById("teamFeePill");
const toggleTeamFeeBtn = document.getElementById("toggleTeamFeeBtn");

// UX filtros (si existen en tu HTML)
const clearLegendFiltersBtn = document.getElementById("clearLegendFilters");
const filtersHintEl = document.getElementById("filtersHint");

// Invitados UI (si existe en tu HTML)
const addGuestBtn = document.getElementById("addGuestBtn");

/* ==========================
   PARAMS / STATE
========================== */
const params = new URLSearchParams(window.location.search);
const tournamentId = (params.get("id") || "").trim();

let tournament = null;
let roster = [];      // tournaments/{id}/roster
let players = [];     // club players (activos)
let guests = [];      // guest_players (activos)

let activeLegendFilters = new Set();

/* ==========================
   EVENTS
========================== */
playersSearch?.addEventListener("input", renderPlayers);
toggleTeamFeeBtn?.addEventListener("click", toggleTeamFeePaid);
addGuestBtn?.addEventListener("click", createGuestFlow);

/* ==========================
   INIT
========================== */
watchAuth(async () => {
  showLoader();
  try {
    if (appVersion) appVersion.textContent = `v${APP_CONFIG.version}`;

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.textContent = "Salir";

    if (!tournamentId) {
      showError("Falta el parámetro del torneo. Ej: tournament_roster.html?id=XXXX");
      return;
    }

    tournament = await fetchTournament(tournamentId);
    if (!tournament) {
      showError("No se encontró el torneo.");
      return;
    }

    // Botón "Detalle" ahora edita el torneo
    if (detailBtn) {
      detailBtn.addEventListener("click", (e) => {
        e.preventDefault();
        editor.openEditById(tournamentId);
      });
    }

    initLegendFiltersUX();

    await loadPlayers();
    await loadGuests();
    await loadRoster();
    render();
    renderPlayers();
  } catch (e) {
    console.error(e);
    showError("Error cargando roster del torneo.");
  } finally {
    hideLoader();
  }
});

// Cuando se edita (o elimina) el torneo desde el modal, refrescamos la info del torneo
window.addEventListener("tournament:changed", async (e) => {
  // si eliminaron este torneo, redirigimos a torneos
  if (e?.detail?.deleted && e.detail.id === tournamentId) {
    window.location.href = "tournaments.html";
    return;
  }

  // refrescar meta/nombre/teamFee
  try {
    tournament = await fetchTournament(tournamentId);
    render();
  } catch (err) {
    console.error(err);
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
  const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const playersById = new Map(players.map(p => [p.id, p]));
  const guestsById = new Map(guests.map(g => [g.id, g]));

  roster = raw
    .map(r => {
      const refId = (r.playerId || r.guestId || r.id || "").trim();

      const fromGuest = r.isGuest ? guestsById.get(refId) : null;
      const fromPlayer = !r.isGuest ? playersById.get(refId) : null;

      const source = fromPlayer || fromGuest || playersById.get(refId) || guestsById.get(refId);

      return {
        ...r,
        name: r.name ?? source?.name ?? "—",
        number: r.number ?? source?.number ?? null,
        role: r.role ?? source?.role ?? null,
        gender: r.gender ?? source?.gender ?? null,
        playerId: r.playerId || refId || null
      };
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
}

async function loadPlayers() {
  const snap = await getDocs(collection(db, PLAYERS_COL));

  players = snap.docs
    .map(d => Player.fromFirestore(d))
    .map(p => ({
      id: p.id,
      name: p.fullName,
      nickname: "",
      role: p.role,
      number: p.number ?? null,
      gender: p.gender,
      active: p.active !== false,
      isGuest: false
    }))
    .filter(p => p.active === true)
    .filter(p => (p.name || "").trim().length > 0)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  if (playersSubtitle) {
    playersSubtitle.textContent = players.length
      ? `${players.length} jugador(es) activo(s)`
      : `No hay jugadores activos disponibles.`;
  }
}

async function loadGuests() {
  const snap = await getDocs(collection(db, GUESTS_COL));

  guests = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .map(g => ({
      id: g.id,
      name: (g.name || "").trim(),
      nickname: g.loanFrom ? `Préstamo: ${g.loanFrom}` : "",
      role: g.role || "hybrid",
      number: g.number ?? null,
      gender: g.gender ?? null,
      active: g.active !== false,
      loanFrom: g.loanFrom || "",
      isGuest: true
    }))
    .filter(g => g.active === true)
    .filter(g => (g.name || "").trim().length > 0)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
}

/* ==========================
   RENDER: ROSTER
========================== */
function render() {
  if (!tournament) return;

  if (tName) tName.textContent = tournament.name || "—";
  if (tMeta) tMeta.textContent = formatTournamentMeta(tournament);

  renderTeamFee();

  let list = [...roster];
  if (activeLegendFilters.size > 0) {
    list = list.filter(matchesLegendFilters);
  }

  if (rosterList) rosterList.innerHTML = list.length ? list.map(rosterRow).join("") : "";

  if (rosterEmpty) {
    rosterEmpty.classList.toggle("d-none", list.length > 0);
    rosterEmpty.textContent = S.roster?.empty || "No hay jugadores asignados a este torneo.";
  }

  renderRosterCounters(list);

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

  rosterList?.querySelectorAll("[data-toggle-paid]")?.forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle-paid");
      await togglePlayerPaid(id);
    });
  });
}