// js/tournament_roster.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS } from "./strings.js";
import { Player } from "./models/player.js";
//edit tournament imports
import { createTournamentEditor } from "./features/tournament_editor.js";
import { loadPartialOnce } from "./ui/loadPartial.js";

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

// ✅ Invitados globales (reutilizables entre torneos)
const GUESTS_COL = APP_CONFIG?.club?.guestsCollection || "guest_players";

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

// Boton de editar
const editTournamentBtn = document.getElementById("editTournamentBtn");

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
   STRINGS -> UI
========================== */
applyStrings();

/* ==========================
   TOURNAMENT EDITOR (LAZY)
========================== */
let tournamentEditor = null;

async function ensureTournamentEditor() {
  await loadPartialOnce("./partials/tournament_editor.html", "modalMount");

  if (!tournamentEditor) {
    tournamentEditor = createTournamentEditor();
  }

  return tournamentEditor; 
}


/* ==========================
   EVENTS
========================== */
// roster search removed (si existe en HTML lo ocultamos)
playersSearch?.addEventListener("input", renderPlayers);
toggleTeamFeeBtn?.addEventListener("click", toggleTeamFeePaid);

// Crear invitado global (si el botón existe)
addGuestBtn?.addEventListener("click", createGuestFlow);

editTournamentBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!tournamentId) return;

  const editor = await ensureTournamentEditor();
  editor?.openEditById(tournamentId);
});

/* ==========================
   EVENTS: TOURNAMENT EDITOR
========================== */
window.addEventListener("tournament:changed", async (e) => {
  const { id, deleted } = e.detail || {};

  // si eliminaron ESTE torneo → salir
  if (deleted && id === tournamentId) {
    alert("Este torneo fue eliminado.");
    window.location.href = "tournaments.html";
    return;
  }

  // si editaron ESTE torneo → refrescar datos
  if (id === tournamentId) {
    showLoader();
    try {
      tournament = await fetchTournament(tournamentId);
      render(); // ya existe en tu archivo
    } catch (err) {
      console.error(err);
      alert("Error recargando el torneo.");
    } finally {
      hideLoader();
    }
  }
});


/* ==========================
   INIT
========================== */
watchAuth(async () => {
  showLoader();
  try {
    if (appVersion) appVersion.textContent = `v${APP_CONFIG.version}`;

    // Asegurar que el header diga solo "Salir" (sin version pegada)
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

    // Detalle (si existe en HTML, lo dejamos funcionando)
    if (detailBtn) {
      detailBtn.href = `tournament_detail.html?id=${encodeURIComponent(tournamentId)}`;
    }

    initLegendFiltersUX();

    await loadPlayers();
    await loadGuests();
    await loadRoster();  // roster último (ya puedo enriquecer)
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

  const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const playersById = new Map(players.map(p => [p.id, p]));
  const guestsById = new Map(guests.map(g => [g.id, g]));

  roster = raw
    .map(r => {
      // ✅ id de referencia para buscar en players/guests
      const refId = (r.playerId || r.guestId || r.id || "").trim();

      // ✅ escoger fuente según isGuest (pero si isGuest no existe, intenta ambas)
      const fromGuest = r.isGuest ? guestsById.get(refId) : null;
      const fromPlayer = !r.isGuest ? playersById.get(refId) : null;

      // fallback si isGuest está mal o no existe:
      const source = fromPlayer || fromGuest || playersById.get(refId) || guestsById.get(refId);

      return {
        ...r,

        // ✅ relleno para contadores y UI (no escribe DB)
        name: r.name ?? source?.name ?? "—",
        number: r.number ?? source?.number ?? null,
        role: r.role ?? source?.role ?? null,
        gender: r.gender ?? source?.gender ?? null,

        // si el doc no trae playerId, lo normalizamos en memoria
        playerId: r.playerId || refId || null
      };
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  // DEBUG útil: ver cuántos quedaron sin género
  console.log(
    "Roster loaded:",
    roster.length,
    "with gender:",
    roster.filter(x => !!x.gender).length
  );
}

async function loadPlayers() {
  const snap = await getDocs(collection(db, PLAYERS_COL));

  players = snap.docs
    .map(d => Player.fromFirestore(d))
    .map(p => ({
      id: p.id,
      name: p.fullName,
      nickname: "",
      role: p.role,          // handler | cutter | hybrid
      number: p.number ?? null,
      gender: p.gender,
      active: p.active !== false,
      isGuest: false
    }))
    .filter(p => p.active === true)
    .filter(p => (p.name || "").trim().length > 0)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  // ✅ No mostrar “Fuente: club_players”
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

  // filtros de leyenda
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

function renderRosterCounters(visibleList) {
  const total = roster.length;

  const m = roster.filter(r => isMale(r.gender)).length;
  const f = roster.filter(r => isFemale(r.gender)).length;

  const handlers = roster.filter(r => isHandler(r.role)).length;
  const cutters = roster.filter(r => isCutter(r.role)).length;

  const guestsCount = roster.filter(r => r.isGuest).length;

  const visibleText =
    visibleList.length !== roster.length
      ? ` · Mostrando: ${visibleList.length}`
      : "";

  const text = total
    ? `Total: ${total}${visibleText} · Invitados: ${guestsCount} · M: ${m} · F: ${f} · Handlers: ${handlers} · Cutters: ${cutters}`
    : "Jugadores convocados";

  if (rosterSubtitle) rosterSubtitle.textContent = text;
  if (pageSubtitle) pageSubtitle.textContent = text;
}

/* ==========================
   RENDER: RIGHT PANEL (PICKER)
   - mezcla jugadores activos + invitados activos
   - quita los ya agregados al roster
========================== */
function renderPlayers() {
  const q = (playersSearch?.value || "").trim().toLowerCase();

  // ids ya en roster
  const rosterIds = new Set(roster.map(r => r.playerId || r.id));

  // pool: jugadores + invitados
  let pool = [...players, ...guests];

  // quitar ya agregados
  let list = pool.filter(p => !rosterIds.has(p.id));

  // buscar
  if (q) {
    list = list.filter(p =>
      `${p.name || ""} ${p.nickname || ""} ${p.role || ""} ${p.loanFrom || ""}`
        .toLowerCase()
        .includes(q)
    );
  }

  if (playersList) {
    playersList.innerHTML = list.length ? list.map(playerPickRow).join("") : "";
  }

  if (playersEmpty) {
    playersEmpty.classList.toggle("d-none", list.length > 0);
    playersEmpty.textContent = q
      ? "No hay coincidencias."
      : "No hay jugadores disponibles (todos ya están en el roster).";
  }

  // subtitle panel derecho
  if (playersSubtitle) {
    const gCount = list.filter(x => x.isGuest).length;
    const pCount = list.length - gCount;
    playersSubtitle.textContent = `Disponibles: ${list.length} · Club: ${pCount} · Invitados: ${gCount}`;
  }

  // ✅ contador (sin optional chaining en el LHS)
  const addPanelState = document.getElementById("addPanelState");
  if (addPanelState) addPanelState.textContent = `Disponibles: ${list.length}`;

  // listeners para agregar
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
async function addToRoster(itemId) {
  // puede venir de players o guests
  const p = players.find(x => x.id === itemId);
  const g = guests.find(x => x.id === itemId);
  const item = p || g;
  if (!item) return;

  showLoader();
  try {
    const ref = doc(db, TOURNAMENTS_COL, tournamentId, "roster", item.id);

    await setDoc(ref, {
      playerId: item.id,
      isGuest: !!item.isGuest,
      guestId: item.isGuest ? item.id : null,
      loanFrom: item.isGuest ? (item.loanFrom || "") : "",
      name: item.name,
      number: item.number ?? null,
      role: item.role || "hybrid",
      gender: item.gender ?? null,
      status: "convocado",
      playerFeePaid: false,
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

async function removeFromRoster(docId) {
  const ok = confirm("¿Quitar del roster?");
  if (!ok) return;

  showLoader();
  try {
    await deleteDoc(doc(db, TOURNAMENTS_COL, tournamentId, "roster", docId));
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

async function toggleStatus(docId) {
  const r = roster.find(x => x.id === docId);
  if (!r) return;

  const next = nextStatus(r.status);

  showLoader();
  try {
    await setDoc(doc(db, TOURNAMENTS_COL, tournamentId, "roster", docId), {
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

async function togglePlayerPaid(docId) {
  const r = roster.find(x => x.id === docId);
  if (!r) return;

  const next = !r.playerFeePaid;

  showLoader();
  try {
    await setDoc(doc(db, TOURNAMENTS_COL, tournamentId, "roster", docId), {
      playerFeePaid: next,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await loadRoster();
    render();
    renderPlayers();
  } catch (e) {
    console.error(e);
    alert("Error actualizando pago del jugador.");
  } finally {
    hideLoader();
  }
}

async function toggleTeamFeePaid() {
  if (!tournament) return;

  const next = !tournament.teamFeePaid;

  showLoader();
  try {
    await setDoc(doc(db, TOURNAMENTS_COL, tournamentId), {
      teamFeePaid: next,
      updatedAt: serverTimestamp()
    }, { merge: true });

    tournament.teamFeePaid = next;
    renderTeamFee();
  } catch (e) {
    console.error(e);
    alert("Error actualizando team fee.");
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
   CREATE GUEST (GLOBAL)
========================== */
async function createGuestFlow() {
  // MVP con prompts (luego lo cambiamos a modal bonito si quieres)
  const name = prompt("Nombre del invitado:");
  if (!name || !name.trim()) return;

  const gender = (prompt("Género (M/F) (opcional):") || "").trim();
  const role = (prompt("Rol (handler/cutter/hybrid) (opcional):") || "hybrid").trim();
  const loanFrom = (prompt("¿Préstamo de qué club? (opcional):") || "").trim();
  const numberRaw = (prompt("Número (opcional):") || "").trim();
  const number = numberRaw ? Number(numberRaw) : null;

  showLoader();
  try {
    const newRef = doc(collection(db, GUESTS_COL));
    await setDoc(newRef, {
      name: name.trim(),
      gender: gender || null,
      role: role || "hybrid",
      loanFrom: loanFrom || "",
      number: Number.isFinite(number) ? number : null,
      active: true,
      createdAt: serverTimestamp()
    });

    await loadGuests();
    renderPlayers();
  } catch (e) {
    console.error(e);
    alert("Error creando invitado.");
  } finally {
    hideLoader();
  }
}

/* ==========================
   UI BUILDERS
========================== */
function rosterRow(r) {
  const role = r.role || "—";

  const status = prettyStatus(r.status);
  const statusClass = status === "Confirmado" ? "pill pill--yellow" : "pill";

  const paid = !!r.playerFeePaid;
  const paidClass = paid ? "pill pill--good" : "pill pill--warn";
  const paidLabel = paid ? "Fee pagado" : "Fee pendiente";

  const guestBadge = r.isGuest
    ? `<span class="pill">${escapeHtml(r.loanFrom ? `Invitado · ${r.loanFrom}` : "Invitado")}</span>`
    : "";

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
          <button class="btn btn-sm btn-outline-secondary" title="Cambiar estado" data-toggle-status="${escapeHtml(r.id)}">
            <i class="bi bi-arrow-repeat"></i>
          </button>

          <button class="btn btn-sm btn-outline-success" title="Toggle fee pagado" data-toggle-paid="${escapeHtml(r.id)}">
            <i class="bi bi-cash-coin"></i>
          </button>

          <button class="btn btn-sm btn-outline-danger" title="Quitar" data-remove="${escapeHtml(r.id)}">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <div class="roster-row__badges">
        <span class="${statusClass}">${escapeHtml(status)}</span>
        <span class="${paidClass}">${escapeHtml(paidLabel)}</span>
        ${guestBadge}
      </div>
    </div>
  `;
}

function playerPickRow(p) {
  const sub = p.isGuest
    ? (p.loanFrom ? `Invitado · ${p.loanFrom}` : "Invitado")
    : (p.role || "");

  const leftTag = p.isGuest ? `<span class="pill">Invitado</span>` : "";

  return `
    <div class="player-pick">
      <div>
        <div class="player-pick__name">
          ${escapeHtml(p.name || "—")}
          ${leftTag}
        </div>
        <div class="player-pick__sub">${escapeHtml(sub || "")}</div>
      </div>

      <button class="btn btn-sm btn-primary"
              data-add="${escapeHtml(p.id)}"
              title="Agregar">
        <i class="bi bi-plus-lg"></i>
      </button>
    </div>
  `;
}

/* ==========================
   TEAM FEE UI
========================== */
function renderTeamFee() {
  if (!teamFeePill || !toggleTeamFeeBtn || !tournament) return;

  const amount = tournament.teamFee != null
    ? `₡${Number(tournament.teamFee).toLocaleString("es-CR")}`
    : "—";

  const paid = !!tournament.teamFeePaid;

  teamFeePill.textContent = `Team fee: ${amount} · ${paid ? "Pagado" : "Pendiente"}`;
  teamFeePill.className = `pill ${paid ? "pill--good" : "pill--warn"}`;

  toggleTeamFeeBtn.innerHTML = paid
    ? `<i class="bi bi-cash-coin"></i> Marcar pendiente`
    : `<i class="bi bi-cash-coin"></i> Marcar pagado`;
}

/* ==========================
   STRINGS
========================== */
function applyStrings() {
  pageTitle && (pageTitle.textContent = S.roster?.title || "Roster del torneo");
  pageSubtitle && (pageSubtitle.textContent = S.roster?.subtitle || "Jugadores convocados");

  rosterTitle && (rosterTitle.textContent = S.roster?.title || "Roster del torneo");
  rosterSubtitle && (rosterSubtitle.textContent = S.roster?.subtitle || "Jugadores convocados");

  // ocultar buscar roster si existe
  if (lblSearch) lblSearch.classList.add("d-none");
  if (searchInput) searchInput.classList.add("d-none");

  playersTitle && (playersTitle.textContent = "Jugadores");
  btnAddLabel && (btnAddLabel.textContent = "Agregar jugador");
}

/* ==========================
   FILTER UX (legend)
========================== */
function initLegendFiltersUX() {
  const btns = document.querySelectorAll(".legend-filter");
  if (!btns.length) return;

  btns.forEach(btn => {
    // tanto span como button
    btn.style.cursor = "pointer";
    btn.setAttribute?.("aria-pressed", "false");

    btn.addEventListener("click", () => {
      const key = btn.dataset?.filter;
      if (!key) return;

      if (activeLegendFilters.has(key)) {
        activeLegendFilters.delete(key);
        btn.classList.remove("is-active", "legend-filter--active");
        btn.setAttribute?.("aria-pressed", "false");
      } else {
        activeLegendFilters.add(key);
        btn.classList.add("is-active", "legend-filter--active");
        btn.setAttribute?.("aria-pressed", "true");
      }

      syncLegendUI();
      render();
    });
  });

  clearLegendFiltersBtn?.addEventListener("click", () => {
    activeLegendFilters.clear();
    btns.forEach(btn => {
      btn.classList.remove("is-active", "legend-filter--active");
      btn.setAttribute?.("aria-pressed", "false");
    });
    syncLegendUI();
    render();
  });

  syncLegendUI();
}

function syncLegendUI() {
  if (clearLegendFiltersBtn) {
    clearLegendFiltersBtn.classList.toggle("d-none", activeLegendFilters.size === 0);
  }

  if (!filtersHintEl) return;

  if (activeLegendFilters.size === 0) {
    filtersHintEl.innerHTML = `Tip: puedes combinar filtros (ej. <strong>Confirmado</strong> + <strong>Fee pendiente</strong>).`;
    return;
  }

  const labels = [];
  for (const f of activeLegendFilters) {
    if (f === "status:confirmado") labels.push("Confirmado");
    else if (f === "status:convocado") labels.push("Convocado");
    else if (f === "fee:pendiente") labels.push("Fee pendiente");
    else if (f === "fee:pagado") labels.push("Fee pagado");
    else labels.push(f);
  }

  filtersHintEl.innerHTML = `Mostrando: <strong>${labels.join(" + ")}</strong>`;
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

function matchesLegendFilters(r) {
  for (const f of activeLegendFilters) {
    const [type, value] = f.split(":");

    if (type === "status") {
      if ((r.status || "").toLowerCase() !== value) return false;
    }

    if (type === "fee") {
      const paid = !!r.playerFeePaid;
      if (value === "pagado" && !paid) return false;
      if (value === "pendiente" && paid) return false;
    }
  }
  return true;
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

// counters helpers
function isMale(g) {
  const v = String(g || "").trim().toLowerCase();
  return ["m", "male", "masculino", "hombre", "man"].includes(v);
}

function isFemale(g) {
  const v = String(g || "").trim().toLowerCase();
  return ["f", "female", "femenino", "mujer", "woman"].includes(v);
}

function isHandler(role) {
  return role === "handler";
}

function isCutter(role) {
  return role === "cutter";
}