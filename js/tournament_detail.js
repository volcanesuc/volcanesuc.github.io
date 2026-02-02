// js/tournament_detail.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS } from "./strings.js";

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

loadHeader("tournaments");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

const S = TOURNAMENT_STRINGS;

// DOM
const versionEl = document.getElementById("appVersion");
const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");

const errorBox = document.getElementById("errorBox");
const detailsWrap = document.getElementById("detailsWrap");

const tName = document.getElementById("tName");
const tDateRange = document.getElementById("tDateRange");
const tBadges = document.getElementById("tBadges");

const tType = document.getElementById("tType");
const tAge = document.getElementById("tAge");
const tVenue = document.getElementById("tVenue");
const tLocation = document.getElementById("tLocation");
const tFees = document.getElementById("tFees");
const tNotes = document.getElementById("tNotes");

const lblType = document.getElementById("lblType");
const lblAge = document.getElementById("lblAge");
const lblVenue = document.getElementById("lblVenue");
const lblLocation = document.getElementById("lblLocation");
const lblFees = document.getElementById("lblFees");
const lblNotes = document.getElementById("lblNotes");

const editBtn = document.getElementById("editBtn");
const rosterBtn = document.getElementById("rosterBtn");

// Strings a UI
applyStrings();

// Params
const params = new URLSearchParams(window.location.search);
const id = (params.get("id") || "").trim();

watchAuth(async () => {
  showLoader();
  try {
    versionEl && (versionEl.textContent = `v${APP_CONFIG.version}`);

    if (!id) {
      showError("Falta el parámetro del torneo. Ej: tournament_detail.html?id=XXXX");
      return;
    }

    const t = await fetchTournament(id);
    if (!t) {
      showError("No se encontró el torneo.");
      return;
    }

    renderDetails(t);
  } catch (e) {
    console.error(e);
    showError("Error cargando el detalle del torneo.");
  } finally {
    hideLoader();
  }
});

async function fetchTournament(tournamentId) {
  const ref = doc(db, "tournaments", tournamentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

function renderDetails(t) {
  errorBox?.classList.add("d-none");
  detailsWrap?.classList.remove("d-none");

  const typeLbl = S.fields.type.options?.[t.type] ?? t.type ?? "—";
  const ageLbl = S.fields.age.options?.[t.age] ?? t.age ?? "—";
  const venueLbl = S.fields.venue.options?.[t.venue] ?? t.venue ?? "—";

  tName.textContent = t.name || "—";
  tDateRange.textContent = formatDateRange(t.dateStart, t.dateEnd);

  tType.textContent = typeLbl;
  tAge.textContent = ageLbl;
  tVenue.textContent = venueLbl;

  tLocation.textContent = t.location || "—";
  tFees.innerHTML = formatFees(t.teamFee, t.playerFee);
  tNotes.textContent = (t.notes || "").trim() || "—";

  // Badges
  if (tBadges) {
    const confirmed = !!t.confirmed;
    const confirmedLabel = confirmed ? (S.fields.confirmed.label || "Confirmado") : "Por confirmar";

    tBadges.innerHTML = [
      pill(typeLbl),
      pill(ageLbl),
      pill(venueLbl),
      pill(confirmed ? "Confirmado" : "Por confirmar")
    ].join("");
  }

  // Links
  if (editBtn) {
    // si luego haces que tournaments.html lea ?edit=ID, esto lo abre directo
    editBtn.href = `tournaments.html?edit=${encodeURIComponent(t.id)}`;
    editBtn.textContent = S.actions.edit;
  }

  if (rosterBtn) {
    // si aún no tienes roster page, lo conectamos luego
    rosterBtn.href = `tournament_roster.html?id=${encodeURIComponent(t.id)}`;
    rosterBtn.textContent = S.roster?.title || "Roster";
  }
}

function applyStrings() {
  pageTitleEl && (pageTitleEl.textContent = S.page.title);
  pageSubtitleEl && (pageSubtitleEl.textContent = S.page.subtitle);

  lblType && (lblType.textContent = S.fields.type.label);
  lblAge && (lblAge.textContent = S.fields.age.label);
  lblVenue && (lblVenue.textContent = S.fields.venue.label);
  lblLocation && (lblLocation.textContent = S.fields.location.label);
  lblNotes && (lblNotes.textContent = S.fields.notes.label);
  lblFees && (lblFees.textContent = S.list.headers.fees);
}

function showError(msg) {
  detailsWrap?.classList.add("d-none");
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.remove("d-none");
}

/* ==========================
   HELPERS
========================== */
function formatDateRange(start, end) {
  if (!start) return "—";
  if (!end) return start;
  return `${start} → ${end}`;
}

function formatFees(teamFee, playerFee) {
  const cur = S.fees?.currency || "₡";
  const tfLabel = S.fees?.team || "Team";
  const pfLabel = S.fees?.player || "Player";

  const tf =
    teamFee != null && teamFee !== ""
      ? `${tfLabel} ${cur}${Number(teamFee).toLocaleString("es-CR")}`
      : null;

  const pf =
    playerFee != null && playerFee !== ""
      ? `${pfLabel} ${cur}${Number(playerFee).toLocaleString("es-CR")}`
      : null;

  if (tf && pf) return `${escapeHtml(tf)} · ${escapeHtml(pf)}`;
  return escapeHtml(tf || pf || "—");
}

function pill(text) {
  return `<span class="pill">${escapeHtml(text || "—")}</span>`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
