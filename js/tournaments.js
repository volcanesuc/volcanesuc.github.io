// tournaments.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { TOURNAMENT_STRINGS } from "./strings.js";

/* ==========================
   INIT HEADER / AUTH
========================== */
loadHeader("tournaments");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

const S = TOURNAMENT_STRINGS;

/* ==========================
   DOM
========================== */
const tableEl = document.getElementById("tournamentsTable");
const cardsEl = document.getElementById("tournamentsCards");
const searchEl = document.getElementById("tournamentSearch");
const addBtn = document.getElementById("addTournamentBtn");

const modalEl = document.getElementById("tournamentModal");
const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

const form = document.getElementById("tournamentForm");
const deleteBtn = document.getElementById("deleteTournamentBtn");

const f = {
  id: document.getElementById("tournamentId"),
  name: document.getElementById("tournamentName"),
  dateStart: document.getElementById("dateStart"),
  dateEnd: document.getElementById("dateEnd"),
  type: document.getElementById("type"),
  age: document.getElementById("age"),
  venue: document.getElementById("venue"),
  location: document.getElementById("location"),
  teamFee: document.getElementById("teamFee"),
  playerFee: document.getElementById("playerFee"),
  notes: document.getElementById("notes"),
  confirmed: document.getElementById("confirmed"),
  title: document.getElementById("tournamentModalTitle"),
  subtitle: document.getElementById("tournamentModalSubtitle"),

  lblName: document.getElementById("lblName"),
  lblDateStart: document.getElementById("lblDateStart"),
  lblDateEnd: document.getElementById("lblDateEnd"),
  lblType: document.getElementById("lblType"),
  lblAge: document.getElementById("lblAge"),
  lblVenue: document.getElementById("lblVenue"),
  lblLocation: document.getElementById("lblLocation"),
  lblTeamFee: document.getElementById("lblTeamFee"),
  lblPlayerFee: document.getElementById("lblPlayerFee"),
  lblNotes: document.getElementById("lblNotes"),
  lblConfirmed: document.getElementById("lblConfirmed"),

  btnCancel: document.getElementById("btnCancel"),
  btnSave: document.getElementById("btnSave")
};

/* ==========================
   STRINGS
========================== */
applyStrings();

let allTournaments = [];

/* ==========================
   LOAD DATA
========================== */
watchAuth(async () => {
  showLoader();
  try {
    await loadTournaments();
    render();
  } catch (e) {
    console.error(e);
  } finally {
    hideLoader();
  }
});

document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;

async function loadTournaments() {
  const snap = await getDocs(collection(db, "tournaments"));
  allTournaments = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.dateStart || "").localeCompare(b.dateStart || ""));
}

/* ==========================
   RENDER
========================== */
function render() {
  const q = (searchEl?.value || "").trim().toLowerCase();

  const list = q
    ? allTournaments.filter(t =>
        `${t.name || ""} ${t.location || ""}`.toLowerCase().includes(q)
      )
    : allTournaments;

  renderTable(list);
  renderCards(list);
}

/* ---------- TABLE (DESKTOP) ---------- */
function renderTable(list) {
  if (!tableEl) return;

  tableEl.innerHTML = list.length
    ? list.map(t => {
        const fees = formatFees(t.teamFee, t.playerFee);
        return `
          <tr>
            <td class="fw-bold">${escapeHtml(t.name)}</td>
            <td>${formatDateRange(t.dateStart, t.dateEnd)}</td>
            <td>${badgeLabel(S.fields.type.options?.[t.type] ?? t.type)}</td>
            <td>${badgeLabel(S.fields.age.options?.[t.age] ?? t.age)}</td>
            <td>${badgeLabel(S.fields.venue.options?.[t.venue] ?? t.venue)}</td>
            <td>${fees}</td>
            <td class="text-end">
              <a class="btn btn-sm btn-outline-secondary me-2"
                 title="Detalles"
                 href="tournament_detail.html?id=${encodeURIComponent(t.id)}">
                <i class="bi bi-eye"></i>
              </a>
              <button class="btn btn-sm btn-outline-primary"
                      title="Editar"
                      data-edit="${t.id}">
                <i class="bi bi-pencil"></i>
              </button>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="7" class="text-muted p-3">${escapeHtml(S.page.empty)}</td></tr>`;

  tableEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEdit(btn.dataset.edit));
  });
}

/* ---------- CARDS (MOBILE) ---------- */
function renderCards(list) {
  if (!cardsEl) return;

  cardsEl.innerHTML = list.length
    ? list.map(t => {
        const fees = formatFees(t.teamFee, t.playerFee);
        const typeLbl = S.fields.type.options?.[t.type] ?? t.type ?? "—";
        const ageLbl = S.fields.age.options?.[t.age] ?? t.age ?? "—";
        const venueLbl = S.fields.venue.options?.[t.venue] ?? t.venue ?? "—";

        return `
          <div class="mobile-card mb-3">
            <div class="mobile-card__title">${escapeHtml(t.name)}</div>
            <div class="mobile-card__sub">
              ${formatDateRange(t.dateStart, t.dateEnd)} · ${escapeHtml(t.location || "—")}
            </div>

            <div class="d-flex flex-wrap gap-2 mt-2">
              <span class="pill">${escapeHtml(typeLbl)}</span>
              <span class="pill">${escapeHtml(ageLbl)}</span>
              <span class="pill">${escapeHtml(venueLbl)}</span>
            </div>

            <div class="d-flex j
