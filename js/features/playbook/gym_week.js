// /js/features/playbook/gym_week.js
// ✅ Viewer público para RUTINA (aunque el HTML diga "Semana")
// ✅ URL: /gym_routine.html?id=<ROUTINE_ID>
//    (tu HTML carga este archivo, así que solo cambiás el nombre del HTML a gym_routine.html si querés)
//
// ✅ Lee gym_routines/{id} y resuelve exerciseItems[] con defaults de gym_exercises cuando vienen null
// ✅ Muestra en accordion los ejercicios con sets/reps/rest (o distance), notas y link de video
// ✅ Si rutina isPublic != true => muestra "Privada"
//
// Requiere IDs en HTML (ya los tenés):
// - #weekTitle
// - #weekDates
// - #weekBadge
// - #alertBox
// - #weekAccordion
// - loading overlay: #loadingOverlay (opcional)
// - body.loading (opcional)

import { db } from "/js/auth/firebase.js";
import { showLoader, hideLoader } from "/js/ui/loader.js";
import { guardPage } from "/js/page-guard.js";
import { loadHeader } from "/js/components/header.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Params
========================= */
const params = new URLSearchParams(window.location.search);
const routineId = params.get("id"); // ✅ /gym_routine.html?id=...

/* =========================
   DOM
========================= */
const $ = {
  title: document.getElementById("weekTitle"),
  dates: document.getElementById("weekDates"),
  badge: document.getElementById("weekBadge"),
  alertBox: document.getElementById("alertBox"),
  acc: document.getElementById("weekAccordion"),
};

if (!routineId) {
  showAlert("Falta parámetro id en el link.", "warning");
  throw new Error("Missing id");
}

/* =========================
   Init
========================= */
const { cfg, redirected } = await guardPage("gym_routine"); // si no existe config, igual sirve
if (!redirected) {
  await loadHeader("playbook", cfg);
}

await boot();

/* =========================
   Boot
========================= */
async function boot() {
  showLoaderSafe();
  try {
    const { routine, items } = await loadRoutineResolved({ routineId });

    // header info
    $.title.textContent = routine.name || "Rutina de gimnasio";
    $.dates.textContent = routine.description || "—";

    // badge public/private
    if (routine.isPublic === true) {
      $.badge.className = "badge text-bg-success";
      $.badge.textContent = "PUBLIC";
    } else {
      $.badge.className = "badge text-bg-warning";
      $.badge.textContent = "PRIVATE";
    }

    // si no es pública, igual mostrala pero con aviso (o podrías bloquear totalmente)
    if (routine.isPublic !== true) {
      showAlert("Esta rutina es privada.", "warning");
    } else {
      clearAlert();
    }

    renderAccordion(items);
  } catch (e) {
    console.error("[gym_routine] boot error:", e);
    showAlert("Error cargando rutina. Ver consola.", "danger");
    $.acc.innerHTML = "";
  } finally {
    hideLoaderSafe();
    document.body.classList.remove("loading");
  }
}

/* =========================
   Data: load + resolve defaults
========================= */
function fmtToStringOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

async function loadRoutineResolved({ routineId }) {
  // 1) rutina
  const rSnap = await getDoc(doc(db, "gym_routines", routineId));
  if (!rSnap.exists()) throw new Error("Rutina no existe");

  const routine = { id: rSnap.id, ...rSnap.data() };

  // 2) items ordenados
  const rawItems = Array.isArray(routine.exerciseItems) ? routine.exerciseItems.slice() : [];
  rawItems.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  // 3) fetch exercises
  const exSnaps = await Promise.all(
    rawItems.map(it => it?.exerciseId ? getDoc(doc(db, "gym_exercises", it.exerciseId)) : Promise.resolve(null))
  );

  // 4) merge (item override > exercise default)
  const items = rawItems.map((it, idx) => {
    const exSnap = exSnaps[idx];
    const ex = exSnap && exSnap.exists() ? { id: exSnap.id, ...exSnap.data() } : null;

    const pick = (overrideVal, baseVal) =>
      (overrideVal === null || overrideVal === undefined) ? baseVal : overrideVal;

    const pickNotes = (overrideNotes, baseNotes) => {
      const o = (overrideNotes ?? "").toString().trim();
      if (o) return o;
      return (baseNotes ?? "").toString().trim();
    };

    return {
      order: it.order ?? (idx + 1),
      exerciseId: it.exerciseId || null,

      name: ex?.name || "—",
      videoUrl: ex?.videoUrl || "",
      bodyParts: Array.isArray(ex?.bodyParts) ? ex.bodyParts : [],

      seriesType: pick(it.seriesType, ex?.seriesType ?? "reps"),
      sets: pick(it.sets, ex?.sets ?? null),
      reps: fmtToStringOrNull(pick(it.reps, ex?.reps ?? null)),
      restSec: pick(it.restSec, ex?.restSec ?? null),
      distance: pick(it.distance, ex?.distance ?? null),
      distanceUnit: pick(it.distanceUnit, ex?.distanceUnit ?? null),

      notes: pickNotes(it.notes, ex?.notes),

      // útil para debug / UI
      _exerciseMissing: !ex,
    };
  });

  return { routine, items };
}

/* =========================
   Render
========================= */
function renderAccordion(items) {
  if (!$.acc) return;
  $.acc.innerHTML = "";

  if (!items.length) {
    $.acc.innerHTML = `
      <div class="text-muted small">
        No hay ejercicios en esta rutina.
      </div>
    `;
    return;
  }

  items.forEach((it, idx) => {
    const id = `ex_${idx}_${safeId(it.exerciseId || idx)}`;
    const title = `${it.order}. ${it.name || "—"}`;

    const tags = it.bodyParts?.length
      ? it.bodyParts.map(t => `<span class="badge text-bg-light me-1">${escapeHtml(t)}</span>`).join("")
      : "";

    const seriesLine = fmtSeriesLine(it);

    const videoBtn = it.videoUrl
      ? `<a class="btn btn-sm btn-outline-secondary" href="${escapeHtml(it.videoUrl)}" target="_blank" rel="noopener">Video</a>`
      : "";

    const missing = it._exerciseMissing
      ? `<span class="badge text-bg-warning ms-2">Ejercicio no existe</span>`
      : "";

    const notesHtml = it.notes
      ? `<div class="small mt-2">${escapeHtml(it.notes)}</div>`
      : `<div class="text-muted small mt-2">—</div>`;

    const itemEl = document.createElement("div");
    itemEl.className = "accordion-item";

    itemEl.innerHTML = `
      <h2 class="accordion-header" id="${id}_h">
        <button class="accordion-button ${idx === 0 ? "" : "collapsed"}" type="button"
                data-bs-toggle="collapse" data-bs-target="#${id}_c"
                aria-expanded="${idx === 0 ? "true" : "false"}" aria-controls="${id}_c">
          <div class="d-flex flex-column">
            <div class="fw-semibold">${escapeHtml(title)}${missing}</div>
            <div class="text-muted small">${escapeHtml(seriesLine)}</div>
          </div>
        </button>
      </h2>

      <div id="${id}_c" class="accordion-collapse collapse ${idx === 0 ? "show" : ""}"
           aria-labelledby="${id}_h" data-bs-parent="#weekAccordion">
        <div class="accordion-body">
          ${tags ? `<div class="mb-2">${tags}</div>` : ``}

          <div class="d-flex gap-2 flex-wrap mb-2">
            ${videoBtn}
            <button class="btn btn-sm btn-outline-primary" data-copy-ex="${escapeHtml(it.exerciseId || "")}">
              Copiar ID
            </button>
          </div>

          <div class="small text-muted">Notas</div>
          ${notesHtml}
        </div>
      </div>
    `;

    $.acc.appendChild(itemEl);
  });

  // copiar id ejercicio (debug)
  $.acc.querySelectorAll("[data-copy-ex]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-copy-ex");
      if (!id) return;
      try {
        await navigator.clipboard.writeText(id);
        const old = btn.textContent;
        btn.textContent = "Copiado ✅";
        setTimeout(() => (btn.textContent = old), 1000);
      } catch {
        alert("No pude copiar el ID.");
      }
    });
  });
}

function fmtSeriesLine(it) {
  const st = (it.seriesType || "reps").toString();
  const parts = [];

  if (st === "distance") {
    const dist = it.distance ?? "—";
    const unit = it.distanceUnit ?? "";
    parts.push(`Distancia: ${dist} ${unit}`.trim());
  } else {
    parts.push(`Sets: ${it.sets ?? "—"}`);
    parts.push(`Reps: ${it.reps ?? "—"}`);
  }

  if (it.restSec !== null && it.restSec !== undefined) {
    parts.push(`Descanso: ${it.restSec}s`);
  }

  return parts.join(" · ");
}

/* =========================
   Alerts / Loader
========================= */
function showAlert(msg, type = "info") {
  const el = $.alertBox;
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("d-none");
}

function clearAlert() {
  $.alertBox?.classList.add("d-none");
}

function showLoaderSafe() {
  try { showLoader(); } catch { /* ignore */ }
}
function hideLoaderSafe() {
  try { hideLoader(); } catch { /* ignore */ }
}

/* =========================
   Utils
========================= */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeId(x) {
  return String(x ?? "").replaceAll(/[^a-zA-Z0-9_-]/g, "_");
}