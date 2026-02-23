import { db } from "../../auth/firebase.js";
import { loadHeader } from "../../components/header.js";
import { showLoader, hideLoader } from "../../ui/loader.js";

import {
  doc, getDoc, getDocs, collection, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL_WEEK = "gym_weeks";
const COL_ROUT = "gym_routines";
const COL_EX = "gym_exercises";

const $ = {
  title: document.getElementById("weekTitle"),
  dates: document.getElementById("weekDates"),
  badge: document.getElementById("weekBadge"),
  alert: document.getElementById("alertBox"),
  acc: document.getElementById("weekAccordion"),
};

function showAlert(msg, type = "info") {
  if (!$.alert) return;
  $.alert.className = `alert alert-${type}`;
  $.alert.textContent = msg;
  $.alert.classList.remove("d-none");
}

function clearAlert() { $.alert?.classList.add("d-none"); }

function getId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function main() {
  try { await loadHeader(null, { role: "viewer", isAdmin: false }); } catch {}

  const id = getId();
  if (!id) {
    showAlert("Falta ?id= en el link.", "warning");
    return;
  }

  showLoader();
  try {
    clearAlert();

    const weekSnap = await getDoc(doc(db, COL_WEEK, id));
    if (!weekSnap.exists()) {
      showAlert("No encontré esta semana.", "danger");
      return;
    }

    const week = { id: weekSnap.id, ...weekSnap.data() };

    $.title && ($.title.textContent = week.name || "Semana de gimnasio");
    $.dates && ($.dates.textContent = `${week.startDate || "—"} → ${week.endDate || "—"}`);

    const isPublic = week.isPublic === true;
    if ($.badge) {
      $.badge.className = `badge ${isPublic ? "text-bg-success" : "text-bg-secondary"}`;
      $.badge.textContent = isPublic ? "PUBLIC" : "PRIVATE";
    }

    if (!isPublic) {
      showAlert("Esta semana está marcada como privada.", "warning");
      return;
    }

    const slots = Array.isArray(week.slots) ? week.slots.slice() : [];
    slots.sort((a, b) => (a.order || 0) - (b.order || 0));

    const routineIds = [...new Set(slots.map(s => s.routineId).filter(Boolean))];

    const routines = {};
    for (const rid of routineIds) {
      const rs = await getDoc(doc(db, COL_ROUT, rid));
      if (rs.exists()) routines[rid] = { id: rs.id, ...rs.data() };
    }

    // Solo rutinas públicas (para no filtrar cosas privadas en link público)
    const publicRoutines = {};
    Object.values(routines).forEach(r => {
      if (r.isPublic === true) publicRoutines[r.id] = r;
    });

    // Ejercicios del mismo club (si week.clubId existe), si no, fallback a todos activos
    const clubId = week.clubId || null;
    const exQ = clubId
      ? query(collection(db, COL_EX), where("clubId", "==", clubId), where("isActive", "==", true))
      : query(collection(db, COL_EX), where("isActive", "==", true));

    const exSnap = await getDocs(exQ);
    const exercises = {};
    exSnap.forEach(d => { exercises[d.id] = { id: d.id, ...d.data() }; });

    renderWeek(slots, publicRoutines, exercises);
  } catch (e) {
    console.error(e);
    showAlert("Error cargando semana. Ver consola.", "danger");
  } finally {
    hideLoader();
    document.body.classList.remove("loading");
  }
}

function renderWeek(slots, routines, exercises) {
  if (!$.acc) return;
  $.acc.innerHTML = "";

  if (!slots.length) {
    $.acc.innerHTML = `<div class="text-muted">Esta semana no tiene rutinas asignadas.</div>`;
    return;
  }

  slots.forEach((s, idx) => {
    const routine = routines[s.routineId];
    const routineName = routine?.name || "Rutina no disponible (privada o borrada)";
    const items = Array.isArray(routine?.exerciseItems) ? routine.exerciseItems.slice() : [];
    items.sort((a, b) => (a.order || 0) - (b.order || 0));

    const accId = `acc_${idx}`;
    const headId = `head_${idx}`;

    const bodyHtml = routine
      ? renderRoutineItems(items, exercises)
      : `<div class="text-muted">No se puede mostrar esta rutina.</div>`;

    const card = document.createElement("div");
    card.className = "accordion-item";
    card.innerHTML = `
      <h2 class="accordion-header" id="${headId}">
        <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button"
                data-bs-toggle="collapse" data-bs-target="#${accId}" aria-expanded="${idx === 0 ? "true" : "false"}">
          <span class="fw-semibold">${escapeHtml(s.label || "Slot")}</span>
          <span class="mx-2 text-muted">·</span>
          <span>${escapeHtml(routineName)}</span>
        </button>
      </h2>
      <div id="${accId}" class="accordion-collapse collapse ${idx === 0 ? "show" : ""}" data-bs-parent="#weekAccordion">
        <div class="accordion-body">
          ${bodyHtml}
        </div>
      </div>
    `;

    $.acc.appendChild(card);
  });
}

function renderRoutineItems(items, exercises) {
  if (!items.length) return `<div class="text-muted">Rutina sin ejercicios.</div>`;

  return items.map((it, i) => {
    const ex = exercises[it.exerciseId];
    const name = ex?.name || "Ejercicio desconocido";
    const parts = Array.isArray(ex?.bodyParts) ? ex.bodyParts.join(", ") : "";
    const video = (ex?.videoUrl || "").trim();

    const sets = it.sets ?? ex?.sets ?? "";
    const reps = it.reps ?? ex?.reps ?? "";
    const dist = it.distance ?? (ex?.distance ? `${ex.distance}${ex.distanceUnit || ""}` : "");
    const rest = it.restSec ?? "";
    const notes = it.notes || ex?.notes || "";

    return `
      <div class="card mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between gap-2 flex-wrap">
            <div>
              <div class="fw-semibold">${i + 1}. ${escapeHtml(name)}</div>
              ${parts ? `<div class="text-muted small">${escapeHtml(parts)}</div>` : ``}
            </div>
            ${video ? `<a class="btn btn-sm btn-outline-secondary" href="${escapeHtml(video)}" target="_blank" rel="noopener">Video</a>` : ``}
          </div>

          <div class="row g-2 mt-2 small">
            <div class="col-6 col-md-2"><span class="text-muted">Sets:</span> ${escapeHtml(String(sets || "—"))}</div>
            <div class="col-6 col-md-2"><span class="text-muted">Reps:</span> ${escapeHtml(String(reps || "—"))}</div>
            <div class="col-6 col-md-3"><span class="text-muted">Dist:</span> ${escapeHtml(String(dist || "—"))}</div>
            <div class="col-6 col-md-2"><span class="text-muted">Desc:</span> ${escapeHtml(String(rest || "—"))}</div>
            <div class="col-12 col-md-3"><span class="text-muted">Notas:</span> ${escapeHtml(String(notes || "—"))}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

main();