// js/tournaments.js
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

loadHeader("tournaments");
document.getElementById("logoutBtn")?.addEventListener("click", logout);

const S = TOURNAMENT_STRINGS;

// Collections from config
const TOURNAMENTS_COL = APP_CONFIG?.club?.tournamentsCollection || "tournaments";

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
   STRINGS -> UI
========================== */
applyStrings();

let allTournaments = [];

/* ==========================
   INIT
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

const appVersionEl = document.getElementById("appVersion");
if (appVersionEl) appVersionEl.textContent = `v${APP_CONFIG.version}`;

/* ==========================
   LOAD
========================== */
async function loadTournaments() {
  const snap = await getDocs(collection(db, TOURNAMENTS_COL));
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
              <button class="btn btn-sm btn-outline-primary" data-edit="${t.id}" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <a class="btn btn-sm btn-outline-secondary ms-2"
                 href="tournament_roster.html?id=${encodeURIComponent(t.id)}"
                 title="Detalles">
                 <i class="bi bi-eye"></i>
              </a>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="7" class="text-muted p-3">${escapeHtml(S.page.empty)}</td></tr>`;

  tableEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEdit(btn.getAttribute("data-edit")));
  });
}

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

            <div class="d-flex justify-content-between align-items-center mt-3">
              <div class="text-muted small">${fees}</div>

              <div class="d-flex gap-2">
                <a class="btn btn-sm btn-outline-secondary"
                   href="tournament_roster.html?id=${encodeURIComponent(t.id)}"
                   title="Detalles">
                  <i class="bi bi-eye"></i>
                </a>

                <button class="btn btn-sm btn-outline-primary" data-edit="${t.id}" title="Editar">
                  <i class="bi bi-pencil"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="text-muted p-2">${escapeHtml(S.page.empty)}</div>`;

  cardsEl.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEdit(btn.getAttribute("data-edit")));
  });
}

/* ==========================
   MODAL
========================== */
addBtn?.addEventListener("click", () => openNew());
searchEl?.addEventListener("input", render);

function openNew() {
  clearForm();
  f.title.textContent = S.actions.add;
  f.subtitle.textContent = S.actions.add;
  if (deleteBtn) deleteBtn.style.display = "none";
  modal?.show();
}

function openEdit(id) {
  const t = allTournaments.find(x => x.id === id);
  if (!t) return;

  f.id.value = t.id;
  f.name.value = t.name || "";
  f.dateStart.value = t.dateStart || "";
  f.dateEnd.value = t.dateEnd || "";
  f.type.value = t.type || "mixto";
  f.age.value = t.age || "open";
  f.venue.value = t.venue || "outdoor";
  f.location.value = t.location || "";
  f.teamFee.value = t.teamFee ?? "";
  f.playerFee.value = t.playerFee ?? "";
  f.notes.value = t.notes || "";
  f.confirmed.checked = !!t.confirmed;

  f.title.textContent = S.actions.edit;
  f.subtitle.textContent = S.actions.edit;
  if (deleteBtn) deleteBtn.style.display = "inline-block";
  modal?.show();
}

function clearForm() {
  f.id.value = "";
  f.name.value = "";
  f.dateStart.value = "";
  f.dateEnd.value = "";
  f.type.value = "mixto";
  f.age.value = "open";
  f.venue.value = "outdoor";
  f.location.value = "";
  f.teamFee.value = "";
  f.playerFee.value = "";
  f.notes.value = "";
  f.confirmed.checked = false;
}

/* ==========================
   SAVE / DELETE
========================== */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoader();

  try {
    const payload = {
      name: f.name.value.trim(),
      dateStart: f.dateStart.value,
      dateEnd: f.dateEnd.value || "",
      type: f.type.value,
      age: f.age.value,
      venue: f.venue.value,
      location: (f.location.value || "").trim(),
      teamFee: toNumberOrNull(f.teamFee.value),
      playerFee: toNumberOrNull(f.playerFee.value),
      notes: (f.notes.value || "").trim(),
      confirmed: !!f.confirmed.checked,
      updatedAt: serverTimestamp()
    };

    if (!payload.name || !payload.dateStart) {
      alert(S.messages?.missingRequired || "Faltan campos obligatorios.");
      return;
    }

    if (f.id.value) {
      await setDoc(doc(db, TOURNAMENTS_COL, f.id.value), payload, { merge: true });
    } else {
      await addDoc(collection(db, TOURNAMENTS_COL), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    await loadTournaments();
    render();
    modal?.hide();
  } catch (err) {
    console.error(err);
    alert(S.messages?.errorSave || "Error guardando torneo.");
  } finally {
    hideLoader();
  }
});

deleteBtn?.addEventListener("click", async () => {
  const id = f.id.value;
  if (!id) return;

  const ok = confirm(S.actions?.confirmDelete || "¿Eliminar este torneo?");
  if (!ok) return;

  showLoader();
  try {
    await deleteDoc(doc(db, TOURNAMENTS_COL, id));
    await loadTournaments();
    render();
    modal?.hide();
  } catch (e) {
    console.error(e);
    alert(S.messages?.errorDelete || "Error eliminando torneo.");
  } finally {
    hideLoader();
  }
});

/* ==========================
   STRINGS APPLY
========================== */
function applyStrings() {
  document.getElementById("pageTitle").textContent = S.page.title;
  document.getElementById("pageHeading").textContent = S.page.title;
  document.getElementById("pageSubtitle").textContent = S.page.subtitle;

  document.getElementById("searchLabel").textContent = S.search?.label || "Buscar";
  document.getElementById("tournamentSearch").placeholder = S.search?.placeholder || "";

  document.getElementById("addTournamentBtn").textContent = `+ ${S.actions.add}`;

  document.getElementById("thName").textContent = S.list.headers.name;
  document.getElementById("thDate").textContent = S.list.headers.date;
  document.getElementById("thType").textContent = S.list.headers.type;
  document.getElementById("thAge").textContent = S.list.headers.age;
  document.getElementById("thVenue").textContent = S.list.headers.venue;
  document.getElementById("thFees").textContent = S.list.headers.fees;
  document.getElementById("thActions").textContent = S.list.headers.actions;

  f.lblName.textContent = S.fields.name.label;
  f.name.placeholder = S.fields.name.placeholder || "";

  f.lblDateStart.textContent = S.fields.dateStart.label;
  f.lblDateEnd.textContent = `${S.fields.dateEnd.label} (opcional)`;

  f.lblType.textContent = S.fields.type.label;
  f.lblAge.textContent = S.fields.age.label;
  f.lblVenue.textContent = S.fields.venue.label;

  f.lblLocation.textContent = `${S.fields.location.label} (opcional)`;
  f.location.placeholder = S.fields.location.placeholder || "";

  f.lblTeamFee.textContent = S.fields.teamFee.label;
  f.lblPlayerFee.textContent = S.fields.playerFee.label;

  f.lblNotes.textContent = S.fields.notes.label;
  f.notes.placeholder = S.fields.notes.placeholder || "";

  f.lblConfirmed.textContent = S.fields.confirmed.label;

  f.btnCancel.textContent = S.actions.cancel;
  f.btnSave.textContent = S.actions.save;
  deleteBtn && (deleteBtn.textContent = S.actions.delete);

  fillSelect(f.type, S.fields.type.options);
  fillSelect(f.age, S.fields.age.options);
  fillSelect(f.venue, S.fields.venue.options);

  f.title.textContent = S.page.title;
  f.subtitle.textContent = "";
}

function fillSelect(selectEl, optionsObj) {
  if (!selectEl || !optionsObj) return;
  selectEl.innerHTML = Object.entries(optionsObj)
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
}

/* ==========================
   HELPERS
========================== */
function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateRange(start, end) {
  if (!start) return "—";
  if (!end) return start;
  return `${start} → ${end}`;
}

function formatFees(teamFee, playerFee) {
  const cur = S.fees?.currency || "₡";
  const tfLabel = S.fees?.team || "Team";
  const pfLabel = S.fees?.player || "Player";

  const tf = teamFee != null ? `${tfLabel} ${cur}${Number(teamFee).toLocaleString("es-CR")}` : null;
  const pf = playerFee != null ? `${pfLabel} ${cur}${Number(playerFee).toLocaleString("es-CR")}` : null;

  if (tf && pf) return `${tf} · ${pf}`;
  return tf || pf || "—";
}

function badgeLabel(txt) {
  return `<span class="pill">${escapeHtml(txt || "—")}</span>`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
