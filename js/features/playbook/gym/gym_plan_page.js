// /js/features/playbook/gym/gym_plan_page.js
import { db } from "/js/auth/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showLoader, hideLoader, updateLoaderMessage } from "/js/ui/loader.js";

const COL_PLANS = "gym_weeks";
const COL_ROUTINES = "gym_routines";

const $ = {
  planTitle: document.getElementById("planTitle"),
  planMeta: document.getElementById("planMeta"),
  planDesc: document.getElementById("planDesc"),
  sectionTitle: document.getElementById("planSectionTitle"),
  routinesList: document.getElementById("routinesList"),
  emptyState: document.getElementById("emptyState"),
  errorBox: document.getElementById("errorBox"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
};

boot().catch((e) => {
  console.error(e);
  showError("No pude cargar el plan (error inesperado).");
  hideLoader(); // ✅ destapa todo aunque falle
});

async function boot() {
  showLoader("Cargando plan…"); // ✅ muestra overlay + deja visible
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
      showError("Falta ?id del plan.");
      return;
    }

    setupCopyLink();

    updateLoaderMessage("Leyendo plan…");
    const snap = await getDoc(doc(db, COL_PLANS, id));
    if (!snap.exists()) {
      showError("Este plan no existe.");
      return;
    }

    const plan = { id: snap.id, ...snap.data() };
    renderHeader(plan);

    // Preferimos slots (nuevo modelo)
    const slots = Array.isArray(plan.slots) ? plan.slots.slice() : [];
    if (slots.length) {
      $.sectionTitle && ($.sectionTitle.textContent = "Slots del plan");
      slots.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

      const routineIds = uniq(
        slots.map((s) => (s?.routineId || "").toString().trim()).filter(Boolean)
      );

      updateLoaderMessage("Cargando rutinas…");
      const routinesById = await fetchRoutinesById(routineIds);

      renderSlots(slots, routinesById);
      return;
    }

    // Fallback legacy: routineIds
    const routineIds = Array.isArray(plan.routineIds) ? plan.routineIds.filter(Boolean) : [];
    if (routineIds.length) {
      $.sectionTitle && ($.sectionTitle.textContent = "Rutinas del plan");

      updateLoaderMessage("Cargando rutinas…");
      const routinesById = await fetchRoutinesById(routineIds);

      renderRoutinesFlat(routineIds, routinesById);
      return;
    }

    $.emptyState?.classList.remove("d-none");
  } finally {
    hideLoader(); // ✅ quita html.preload + body.loading + overlay
  }
}