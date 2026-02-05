// js/tournament_roster.js

import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS } from "./strings.js";
import { Player } from "./models/player.js"; 
import { createTournamentEditor } from "./features/tournament_editor.js";
import { loadPartialOnce } from "./ui/loadPartial.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ==========================
   HEADER / AUTH
========================== */
loadHeader("tournaments");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

/* ==========================
   CONFIG / STATE
========================== */
const S = TOURNAMENT_STRINGS;
const TOURNAMENTS_COL =
  APP_CONFIG?.club?.tournamentsCollection || "tournaments";

const params = new URLSearchParams(window.location.search);
const tournamentId = (params.get("id") || "").trim();

let tournament = null;

/* ==========================
   DOM
========================== */
const editTournamentBtn = document.getElementById("editTournamentBtn");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

/* ==========================
   TOURNAMENT EDITOR (LAZY)
========================== */
let tournamentEditor = null;

async function ensureTournamentEditor() {
  // carga el HTML del modal solo una vez
  await loadPartialOnce(
    "./partials/tournament_editor.html",
    "tournamentModal"
  );

  // crea la instancia JS solo una vez
  if (!tournamentEditor) {
    tournamentEditor = createTournamentEditor();
  }
}

/* ==========================
   EVENTS
========================== */
editTournamentBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!tournamentId) return;

  await ensureTournamentEditor();
  tournamentEditor.openEditById(tournamentId);
});

/* refrescar cuando el editor guarda / borra */
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
      render();
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
    if (!tournamentId) {
      alert("Falta el ID del torneo.");
      return;
    }

    tournament = await fetchTournament(tournamentId);
    if (!tournament) {
      alert("No se encontró el torneo.");
      return;
    }

    render();
  } catch (e) {
    console.error(e);
    alert("Error cargando el torneo.");
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

/* ==========================
   RENDER
========================== */
function render() {
  if (!tournament) return;

  pageTitle && (pageTitle.textContent = tournament.name || "Torneo");
  pageSubtitle && (pageSubtitle.textContent = formatTournamentMeta(tournament));
}

/* ==========================
   HELPERS
========================== */
function formatTournamentMeta(t) {
  const start = t.dateStart || "—";
  const end = t.dateEnd || "";
  const where = t.location || "—";
  return end
    ? `${start} → ${end} · ${where}`
    : `${start} · ${where}`;
}
