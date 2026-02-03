// js/tournament_roster.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS } from "./strings.js";
import { Player } from "./models/player.js";

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

// Legend filters UX
const clearLegendFiltersBtn = document.getElementById("clearLegendFilters");
const filtersHintEl = document.getElementById("filtersHint");

/* ==========================
   PARAMS / STATE
========================== */
const params = new URLSearchParams(window.location.search);
const tournamentId = (params.get("id") || "").trim();

let tournament = null;
let roster = [];     // tournaments/{id}/roster
let players = [];    // club players

let activeLegendFilters = new Set();

/* ==========================
   STRINGS -> UI
========================== */
applyStrings();

/* ==========================
   EVENTS
========================== */
// roster search removed
// searchInput?.addEventListener("input", render);

playersSearch?.addEventListener("input", renderPlayers);

toggleTeamFeeBtn?.addEventListener("click", toggleTeamFeePaid);

/* ==========================
   INIT
========================== */
watchAuth(async () => {
  showLoader();
  try {
    if (appVersion) appVersion.textContent = `v${APP_CONFIG.version}`;

    // Asegurar que el header diga solo "Salir"
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

    // Ocultar detalle si no lo usas en esta pantalla
    if (detailBtn) detailBtn.classList.add("d-none");

    // Inicializar UX de filtros (ahora que el DOM ya existe)
    initLegendFiltersUX();

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
    .map(d => Player.fromFirestore(d))
    .map(p => ({
      id: p.id,
      name: p.fullName,
      nickname: "",
      role: p.role,          // handler | cutter | hybrid
      number: p.number ?? null,
      gender: p.gender,
      active: p.active !== false
    }))
    .filter(p => p.active === true)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  if (playersSubtitle) {
    playersSubtitle.textContent =
      players.length
        ? `${players.length} jugador(es) activo(s)`
        : `No hay jugadores activos disponibles (o rules bloqueando lectura).`;
  }
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

  // aplicar filtros de leyenda
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

function renderRosterCounters(list) {
  const total = list.length;

  const m = list.filter(r => isMale(r.gender)).length;
  const f = list.filter(r => isFemale(r.gender)).length;

  const handlers = list.filter(r => isHandler(r.role)).length;
  const cutters = list.filter(r => isCutter(r.role)).length;

  const text = total
    ? `Total: ${total} · M: ${m} · F: ${f} · Handlers: ${handlers} · Cutters: ${cutters}`
    : (S.roster?.subtitle || "Jugadores convocados");

  if (rosterSubtitle) rosterSubtitle.textContent = text;
  if (pageSubtitle) pageSubtitle.textContent = text;
}

/* ==========================
   RENDER: PLAYERS PICKER
========================== */
function renderPlayers() {
  const q = (playersSearch?.value || "").trim().toLowerCase();

  // ids que ya están en el roster (por docId o playerId)
  const rosterIds = new Set(roster.map(r => r.playerId || r.id));

  // SOLO jugadores que NO están en roster
  let list = players.filter(p => !rosterIds.has(p.id));

  if (q) {
    list = list.filter(p =>
      `${p.name || ""} ${p.nickname || ""} ${p.role || ""}`
        .toLowerCase()
        .includes(q)
    );
  }

  if (playersList) {
    playersList.innerHTML = list.length
      ? list.map(p => playerPickRow(p)).join("")
      : "";
  }

  if (playersEmpty) {
    playersEmpty.classList.toggle("d-none", list.length > 0);
    playersEmpty.textContent = q
      ? "No hay coincidencias."
      : "No hay jugadores disponibles (todos ya están en el roster).";
  }

  if (playersSubtitle) {
    playersSubtitle.textContent = `Disponibles: ${list.length}`;
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
    const ref = doc(db, TOURNAMENTS_COL, tournamentId, "roster", playerId);

    await setDoc(ref, {
      playerId,
      name: p.name,
      number: p.number ?? null,
      role: p.role,
      gender: p.gender,
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
   UI BUILDERS
========================== */
function rosterRow(r) {
  const role = r.role || "—";

  const status = prettyStatus(r.status);
  const statusClass = status === "Confirmado" ? "pill pill--yellow" : "pill";

  const paid = !!r.playerFeePaid;
  const paidClass = paid ? "pill pill--good" : "pill pill--warn";
  const paidLabel = paid ? "Fee pagado" : "Fee pendiente";

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
      </div>
    </div>
  `;
}

function playerPickRow(p) {
  const sub = p.nickname ? `${p.nickname}` : (p.role || "");

  return `
    <div class="player-pick">
      <div>
        <div class="player-pick__name">${escapeHtml(p.name || "—")}</div>
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

  // quitar UI de buscar roster si existe en el HTML
  if (lblSearch) lblSearch.classList.add("d-none");
  if (searchInput) searchInput.classList.add("d-none");

  playersTitle && (playersTitle.textContent = "Jugadores");
  btnAddLabel && (btnAddLabel.textContent = "Agregar jugador");
}

/* ==========================
   FILTER UX (syncLegendUI)
========================== */
function initLegendFiltersUX() {
  // Marca como botones "toggle" y aplica handlers
  const btns = document.querySelectorAll(".legend-filter");

  btns.forEach(btn => {
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", () => {
      const key = btn.dataset.filter;
      if (!key) return;

      if (activeLegendFilters.has(key)) {
        activeLegendFilters.delete(key);
        btn.classList.remove("is-active");
        btn.setAttribute("aria-pressed", "false");
      } else {
        activeLegendFilters.add(key);
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
      }

      syncLegendUI();
      render();
    });
  });

  clearLegendFiltersBtn?.addEventListener("click", () => {
    activeLegendFilters.clear();

    btns.forEach(btn => {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-pressed", "false");
    });

    syncLegendUI();
    render();
  });

  syncLegendUI();
}

function syncLegendUI() {
  // Mostrar botón "Limpiar" solo cuando hay filtros activos
  if (clearLegendFiltersBtn) {
    clearLegendFiltersBtn.classList.toggle("d-none", activeLegendFilters.size === 0);
  }

  // Hint: mostrar qué filtros están activos (más claro UX)
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

  filtersHintEl.innerHTML = `Mostrando: <strong>${labels.join(" + ")}</strong> · <a href="#" id="filtersClearLink">Limpiar</a>`;
  // link inline para limpiar rápido
  document.getElementById("filtersClearLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearLegendFiltersBtn?.click();
  });
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

// ---- counters helpers ----
function isMale(g) {
  return g === "M" || g === "m" || g === "male";
}

function isFemale(g) {
  return g === "F" || g === "f" || g === "female";
}

function isHandler(role) {
  return role === "handler";
}

function isCutter(role) {
  return role === "cutter";
}
