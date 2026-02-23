// /js/features/playbook/gym/gym_editors.js
// Escucha eventos y abre modales/partials de gym (create/edit)

import { db } from "/js/auth/firebase.js";
import { showLoader, hideLoader } from "/js/ui/loader.js";

// ✅ si vos ya tenés loadPartialOnce en tu proyecto:
import { loadPartialOnce } from "/js/ui/loadPartial.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * CAMBIÁ ESTOS PATHS a tus partials reales (si existen):
 */
const PARTIAL_EXERCISE = "/partials/gym_exercise_modal.html";
const PARTIAL_ROUTINE  = "/partials/gym_routine_modal.html";
const PARTIAL_WEEK     = "/partials/gym_week_modal.html";

// mount donde inyectás partials (en playbook ya tenés #modalMount)
const MOUNT_ID = "modalMount";

/**
 * CAMBIÁ ESTOS IDs a los IDs reales dentro del modal inyectado
 * (si tu modal de "crear ejercicio" ya existe)
 */
const EXERCISE_MODAL_ID = "gymExerciseModal";
const EXERCISE_FORM_ID  = "gymExerciseForm";

window.addEventListener("gym:exercise:new", async () => {
  await openExerciseModal({ mode: "new" });
});

window.addEventListener("gym:exercise:edit", async (e) => {
  const id = e.detail?.id;
  if (!id) return;
  await openExerciseModal({ mode: "edit", id });
});

window.addEventListener("gym:routine:new", async () => {
  await openRoutineModal();
});

window.addEventListener("gym:week:new", async () => {
  await openWeekModal();
});

// ----------------------------

async function openExerciseModal({ mode, id }) {
  showLoader();
  try {
    await loadPartialOnce(PARTIAL_EXERCISE, MOUNT_ID);

    const modalEl = document.getElementById(EXERCISE_MODAL_ID);
    if (!modalEl) {
      console.warn("[gym_editors] No encuentro modal ejercicio:", EXERCISE_MODAL_ID);
      return;
    }

    // Si es edit: cargar doc y prellenar
    if (mode === "edit") {
      const snap = await getDoc(doc(db, "gym_exercises", id));
      if (!snap.exists()) {
        alert("Ejercicio no existe.");
        return;
      }
      const ex = snap.data();

      // 👇 ACÁ es donde mapeás tus inputs reales (IDs reales del modal)
      // Ejemplo (cambiá los IDs):
      document.getElementById("geName") && (document.getElementById("geName").value = ex.name || "");
      document.getElementById("geSets") && (document.getElementById("geSets").value = ex.sets ?? "");
      document.getElementById("geReps") && (document.getElementById("geReps").value = ex.reps ?? "");
      document.getElementById("geRest") && (document.getElementById("geRest").value = ex.restSec ?? "");
      document.getElementById("geNotes") && (document.getElementById("geNotes").value = ex.notes || "");
      document.getElementById("geVideoUrl") && (document.getElementById("geVideoUrl").value = ex.videoUrl || "");

      // guardá el id en el modal para que el submit haga update
      modalEl.setAttribute("data-edit-id", id);
    } else {
      modalEl.removeAttribute("data-edit-id");
      // reset si querés
      document.getElementById(EXERCISE_FORM_ID)?.reset?.();
    }

    // abrir modal bootstrap
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } finally {
    hideLoader();
  }
}

async function openRoutineModal() {
  showLoader();
  try {
    await loadPartialOnce(PARTIAL_ROUTINE, MOUNT_ID);
    const modalEl = document.getElementById("gymRoutineModal"); // cambiá id real
    if (!modalEl) return console.warn("[gym_editors] No encuentro modal rutina");
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } finally {
    hideLoader();
  }
}

async function openWeekModal() {
  showLoader();
  try {
    await loadPartialOnce(PARTIAL_WEEK, MOUNT_ID);
    const modalEl = document.getElementById("gymWeekModal"); // cambiá id real
    if (!modalEl) return console.warn("[gym_editors] No encuentro modal semana");
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } finally {
    hideLoader();
  }
}