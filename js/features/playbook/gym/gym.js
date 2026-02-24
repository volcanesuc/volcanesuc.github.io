/* =========================================================
   /js/features/playbook/gym/gym_editors.js
   ✅ Crea/edita: Ejercicios, Rutinas, Semanas
   ✅ Escucha eventos emitidos por gym.js:
      - gymUI:exercise:new / gymUI:exercise:edit {id}
      - gymUI:routine:new  / gymUI:routine:edit  {id}
      - gymUI:week:new    / gymUI:week:edit    {id}

   ✅ Si no existen modales en HTML, los inyecta (Bootstrap 5).
   ✅ Guarda en Firestore:
      - gym_exercises
      - gym_routines
      - gym_weeks
   ✅ Emite refresh:
      - window.dispatchEvent(new Event("gym:exercisesChanged"))
      - window.dispatchEvent(new Event("gym:routinesChanged"))
      - window.dispatchEvent(new Event("gym:weeksChanged"))

   Requisitos:
   - Bootstrap bundle cargado (Modal en window.bootstrap)
   - Firebase ya inicializado y db pasado desde initGymTab/init principal
========================================================= */

import {
  collection,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================
   Collections
========================= */
const COL_EXERCISES = "gym_exercises";
const COL_ROUTINES  = "gym_routines";
const COL_WEEKS     = "gym_weeks";

/* =========================
   State
========================= */
let _ctx = {
  db: null,
  clubId: "volcanes",
  canEdit: false,
  modalMountId: "modalMount",
};

let $ = {};
let _exercisesCache = []; // para armar rutinas
let _routinesCache = [];  // para armar semanas

/* =========================
   Public API
========================= */
export async function initGymEditors({ db, clubId, canEdit, modalMountId }) {
  _ctx = { db, clubId, canEdit, modalMountId: modalMountId || "modalMount" };

  ensureModalMount();
  ensureAllModals();
  cacheDom();
  bindUIEvents();

  // precarga data para selects
  await Promise.all([refreshExercisesCache(), refreshRoutinesCache()]);
}

/* =========================
   Modal Mount
========================= */
function ensureModalMount() {
  let mount = document.getElementById(_ctx.modalMountId);
  if (!mount) {
    mount = document.createElement("div");
    mount.id = _ctx.modalMountId;
    document.body.appendChild(mount);
  }
}

function ensureAllModals() {
  ensureExerciseModal();
  ensureRoutineModal();
  ensureWeekModal();
}

/* =========================
   Inject Modals (si no existen)
========================= */
function ensureExerciseModal() {
  if (document.getElementById("gymExerciseModal")) return;

  document.getElementById(_ctx.modalMountId).insertAdjacentHTML("beforeend", `
  <div class="modal fade" id="gymExerciseModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="gymExerciseModalTitle">Ejercicio</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>

        <form id="gymExerciseForm">
          <div class="modal-body">
            <div class="alert d-none" id="gymExerciseAlert" role="alert"></div>

            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Nombre</label>
                <input class="form-control" id="geName" required maxlength="120" />
              </div>

              <div class="col-12">
                <label class="form-label">Partes del cuerpo (separadas por coma)</label>
                <input class="form-control" id="geBodyParts" placeholder="Espalda, dorsales, bíceps" />
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label">Tipo</label>
                <select class="form-select" id="geSeriesType">
                  <option value="reps" selected>Reps</option>
                  <option value="distance">Distancia</option>
                </select>
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label">Sets</label>
                <input class="form-control" id="geSets" type="number" min="1" step="1" placeholder="4" />
              </div>

              <div class="col-12 col-md-4" id="geRepsWrap">
                <label class="form-label">Reps</label>
                <input class="form-control" id="geReps" placeholder="6-10" />
              </div>

              <div class="col-12 col-md-6 d-none" id="geDistanceWrap">
                <label class="form-label">Distancia</label>
                <input class="form-control" id="geDistance" type="number" min="0" step="0.01" placeholder="2" />
              </div>
              <div class="col-12 col-md-6 d-none" id="geDistanceUnitWrap">
                <label class="form-label">Unidad</label>
                <input class="form-control" id="geDistanceUnit" placeholder="km / m" />
              </div>

              <div class="col-12 col-md-4">
                <label class="form-label">Descanso (seg)</label>
                <input class="form-control" id="geRest" type="number" min="0" step="1" placeholder="60" />
              </div>

              <div class="col-12 col-md-8">
                <label class="form-label">Video URL</label>
                <input class="form-control" id="geVideoUrl" placeholder="https://..." />
              </div>

              <div class="col-12">
                <label class="form-label">Notas</label>
                <textarea class="form-control" id="geNotes" rows="3" placeholder="Cues, técnica, etc."></textarea>
              </div>

              <div class="col-12 form-check">
                <input class="form-check-input" type="checkbox" id="geIsActive" checked />
                <label class="form-check-label" for="geIsActive">Activo</label>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="geSaveBtn">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  `);
}

function ensureRoutineModal() {
  if (document.getElementById("gymRoutineModal")) return;

  document.getElementById(_ctx.modalMountId).insertAdjacentHTML("beforeend", `
  <div class="modal fade" id="gymRoutineModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="gymRoutineModalTitle">Rutina</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>

        <form id="gymRoutineForm">
          <div class="modal-body">
            <div class="alert d-none" id="gymRoutineAlert" role="alert"></div>

            <div class="row g-3">
              <div class="col-12 col-lg-6">
                <label class="form-label">Nombre</label>
                <input class="form-control" id="grName" required maxlength="140" />
              </div>
              <div class="col-12 col-lg-6">
                <label class="form-label">Descripción</label>
                <input class="form-control" id="grDescription" maxlength="200" />
              </div>

              <div class="col-12 d-flex gap-3 flex-wrap">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="grIsPublic" />
                  <label class="form-check-label" for="grIsPublic">Pública</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="grIsActive" checked />
                  <label class="form-check-label" for="grIsActive">Activa</label>
                </div>
              </div>

              <div class="col-12">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div class="fw-semibold">Ejercicios de la rutina</div>
                  <button class="btn btn-sm btn-outline-primary" type="button" id="grAddItemBtn">+ Agregar ejercicio</button>
                </div>

                <div class="border rounded p-2">
                  <div class="text-muted small mb-2">
                    Seleccioná ejercicio y opcionalmente override de sets/reps/descanso/notas.
                    Si dejás vacío, usa defaults del ejercicio.
                  </div>

                  <div id="grItems"></div>

                  <div class="text-muted small mt-2">
                    Tip: reordená con “↑ ↓”.
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="grSaveBtn">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  `);
}

function ensureWeekModal() {
  if (document.getElementById("gymWeekModal")) return;

  document.getElementById(_ctx.modalMountId).insertAdjacentHTML("beforeend", `
  <div class="modal fade" id="gymWeekModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="gymWeekModalTitle">Semana</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>

        <form id="gymWeekForm">
          <div class="modal-body">
            <div class="alert d-none" id="gymWeekAlert" role="alert"></div>

            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Nombre</label>
                <input class="form-control" id="gwName" required maxlength="140" />
              </div>

              <div class="col-12">
                <label class="form-label">Descripción</label>
                <input class="form-control" id="gwDescription" maxlength="200" />
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Inicio (opcional)</label>
                <input class="form-control" id="gwStart" type="date" />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">Fin (opcional)</label>
                <input class="form-control" id="gwEnd" type="date" />
              </div>

              <div class="col-12">
                <label class="form-label">Rutinas incluidas (selección múltiple)</label>
                <select class="form-select" id="gwRoutineIds" multiple size="8"></select>
                <div class="text-muted small mt-1">
                  Mantén presionado Ctrl/Cmd para seleccionar varias.
                </div>
              </div>

              <div class="col-12 form-check">
                <input class="form-check-input" type="checkbox" id="gwIsActive" checked />
                <label class="form-check-label" for="gwIsActive">Activa</label>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="gwSaveBtn">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  `);
}

/* =========================
   Cache DOM
========================= */
function cacheDom() {
  $ = {
    // Exercise
    exModal: document.getElementById("gymExerciseModal"),
    exForm: document.getElementById("gymExerciseForm"),
    exAlert: document.getElementById("gymExerciseAlert"),
    geName: document.getElementById("geName"),
    geBodyParts: document.getElementById("geBodyParts"),
    geSeriesType: document.getElementById("geSeriesType"),
    geSets: document.getElementById("geSets"),
    geReps: document.getElementById("geReps"),
    geRest: document.getElementById("geRest"),
    geNotes: document.getElementById("geNotes"),
    geVideoUrl: document.getElementById("geVideoUrl"),
    geDistance: document.getElementById("geDistance"),
    geDistanceUnit: document.getElementById("geDistanceUnit"),
    geIsActive: document.getElementById("geIsActive"),
    geRepsWrap: document.getElementById("geRepsWrap"),
    geDistanceWrap: document.getElementById("geDistanceWrap"),
    geDistanceUnitWrap: document.getElementById("geDistanceUnitWrap"),

    // Routine
    rtModal: document.getElementById("gymRoutineModal"),
    rtForm: document.getElementById("gymRoutineForm"),
    rtAlert: document.getElementById("gymRoutineAlert"),
    grName: document.getElementById("grName"),
    grDescription: document.getElementById("grDescription"),
    grIsPublic: document.getElementById("grIsPublic"),
    grIsActive: document.getElementById("grIsActive"),
    grItems: document.getElementById("grItems"),
    grAddItemBtn: document.getElementById("grAddItemBtn"),

    // Week
    wkModal: document.getElementById("gymWeekModal"),
    wkForm: document.getElementById("gymWeekForm"),
    wkAlert: document.getElementById("gymWeekAlert"),
    gwName: document.getElementById("gwName"),
    gwDescription: document.getElementById("gwDescription"),
    gwStart: document.getElementById("gwStart"),
    gwEnd: document.getElementById("gwEnd"),
    gwRoutineIds: document.getElementById("gwRoutineIds"),
    gwIsActive: document.getElementById("gwIsActive"),
  };

  // seriesType toggle
  $?.geSeriesType?.addEventListener("change", syncExerciseTypeUI);
  syncExerciseTypeUI();
}

/* =========================
   Bind window events from gym.js
========================= */
function bindUIEvents() {
  // Exercise events
  window.addEventListener("gymUI:exercise:new", () => openExerciseModal({ mode: "new" }));
  window.addEventListener("gymUI:exercise:edit", async (ev) => openExerciseModal({ mode: "edit", id: ev?.detail?.id }));

  // Routine events
  window.addEventListener("gymUI:routine:new", async () => openRoutineModal({ mode: "new" }));
  window.addEventListener("gymUI:routine:edit", async (ev) => openRoutineModal({ mode: "edit", id: ev?.detail?.id }));

  // Week events
  window.addEventListener("gymUI:week:new", async () => openWeekModal({ mode: "new" }));
  window.addEventListener("gymUI:week:edit", async (ev) => openWeekModal({ mode: "edit", id: ev?.detail?.id }));

  // Form submits
  $?.exForm?.addEventListener("submit", onSaveExercise);
  $?.rtForm?.addEventListener("submit", onSaveRoutine);
  $?.wkForm?.addEventListener("submit", onSaveWeek);

  // Add routine item
  $?.grAddItemBtn?.addEventListener("click", () => addRoutineItemRow());
}

/* =========================
   Auth + Permissions
========================= */
function requireEdit() {
  if (!_ctx.canEdit) throw new Error("No tenés permisos para editar.");
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Tenés que iniciar sesión para guardar.");
  return uid;
}

/* =========================
   EXERCISE: Open / Fill / Save
========================= */
function openExerciseModal({ mode, id }) {
  clearAlert($?.exAlert);
  resetExerciseForm();

  $?.exModal?.setAttribute("data-mode", mode);
  if (mode === "edit" && id) $?.exModal?.setAttribute("data-edit-id", id);
  else $?.exModal?.removeAttribute("data-edit-id");

  document.getElementById("gymExerciseModalTitle").textContent =
    mode === "edit" ? "Editar ejercicio" : "Crear ejercicio";

  if (mode === "edit" && id) {
    loadExerciseToForm(id).then(() => showModal($?.exModal));
  } else {
    showModal($?.exModal);
  }
}

async function loadExerciseToForm(id) {
  const snap = await getDoc(doc(_ctx.db, COL_EXERCISES, id));
  if (!snap.exists()) throw new Error("Ejercicio no existe");

  const ex = snap.data() || {};
  $?.geName && ($.geName.value = ex.name || "");
  $?.geBodyParts && ($.geBodyParts.value = Array.isArray(ex.bodyParts) ? ex.bodyParts.join(", ") : "");
  $?.geSeriesType && ($.geSeriesType.value = (ex.seriesType || "reps").toString());
  $?.geSets && ($.geSets.value = ex.sets ?? "");
  $?.geReps && ($.geReps.value = ex.reps ?? "");
  $?.geRest && ($.geRest.value = ex.restSec ?? "");
  $?.geNotes && ($.geNotes.value = ex.notes || "");
  $?.geVideoUrl && ($.geVideoUrl.value = ex.videoUrl || "");
  $?.geDistance && ($.geDistance.value = ex.distance ?? "");
  $?.geDistanceUnit && ($.geDistanceUnit.value = ex.distanceUnit ?? "");
  $?.geIsActive && ($.geIsActive.checked = ex.isActive !== false);

  syncExerciseTypeUI();
}

function resetExerciseForm() {
  $?.exForm?.reset?.();
  // garantizar defaults
  if ($?.geSeriesType) $.geSeriesType.value = "reps";
  if ($?.geIsActive) $.geIsActive.checked = true;
  syncExerciseTypeUI();
}

function syncExerciseTypeUI() {
  const st = ($?.geSeriesType?.value || "reps").toString();
  const isDistance = st === "distance";

  $?.geRepsWrap?.classList.toggle("d-none", isDistance);
  $?.geDistanceWrap?.classList.toggle("d-none", !isDistance);
  $?.geDistanceUnitWrap?.classList.toggle("d-none", !isDistance);
}

async function onSaveExercise(ev) {
  ev.preventDefault();

  try {
    const uid = requireEdit();
    clearAlert($?.exAlert);

    const mode = $?.exModal?.getAttribute("data-mode") || "new";
    const editId = $?.exModal?.getAttribute("data-edit-id") || null;

    const payload = readExercisePayload(uid);

    if (!payload.name) {
      showAlert($?.exAlert, "El nombre es requerido.", "warning");
      return;
    }

    if (mode === "edit" && editId) {
      await updateDoc(doc(_ctx.db, COL_EXERCISES, editId), {
        ...payload,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    } else {
      await addDoc(collection(_ctx.db, COL_EXERCISES), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
        updatedBy: uid,
      });
    }

    hideModal($?.exModal);

    await refreshExercisesCache();
    window.dispatchEvent(new Event("gym:exercisesChanged"));
  } catch (e) {
    console.error("SAVE EXERCISE ERROR:", e);
    showAlert($?.exAlert, e?.message || "Error guardando ejercicio.", "danger");
  }
}

function readExercisePayload(uid) {
  const name = trim($?.geName?.value);
  const bodyParts = parseCSV($?.geBodyParts?.value);

  const seriesType = ($?.geSeriesType?.value || "reps").toString();
  const sets = toNumberOrNull($?.geSets?.value);
  const restSec = toNumberOrNull($?.geRest?.value);

  const reps = seriesType === "reps" ? toStringOrNull($?.geReps?.value) : null;
  const distance = seriesType === "distance" ? toNumberOrNull($?.geDistance?.value) : null;
  const distanceUnit = seriesType === "distance" ? toStringOrNull($?.geDistanceUnit?.value) : null;

  const notes = toStringOrNull($?.geNotes?.value);
  const videoUrl = toStringOrNull($?.geVideoUrl?.value);

  const isActive = !!$?.geIsActive?.checked;

  return {
    clubId: _ctx.clubId,
    name,
    bodyParts,
    seriesType,
    sets,
    reps,
    restSec,
    distance,
    distanceUnit,
    notes,
    videoUrl,
    isActive,
  };
}

/* =========================
   ROUTINE: Open / Fill / Save
========================= */
async function openRoutineModal({ mode, id }) {
  clearAlert($?.rtAlert);
  resetRoutineForm();

  await refreshExercisesCache(); // asegurar select con ejercicios

  $?.rtModal?.setAttribute("data-mode", mode);
  if (mode === "edit" && id) $?.rtModal?.setAttribute("data-edit-id", id);
  else $?.rtModal?.removeAttribute("data-edit-id");

  document.getElementById("gymRoutineModalTitle").textContent =
    mode === "edit" ? "Editar rutina" : "Crear rutina";

  if (mode === "edit" && id) {
    await loadRoutineToForm(id);
  } else {
    // arranca con 1 fila
    addRoutineItemRow();
  }

  showModal($?.rtModal);
}

function resetRoutineForm() {
  $?.rtForm?.reset?.();
  if ($?.grIsActive) $.grIsActive.checked = true;
  if ($?.grIsPublic) $.grIsPublic.checked = false;
  if ($?.grItems) $.grItems.innerHTML = "";
}

async function loadRoutineToForm(id) {
  const snap = await getDoc(doc(_ctx.db, COL_ROUTINES, id));
  if (!snap.exists()) throw new Error("Rutina no existe");
  const r = snap.data() || {};

  $?.grName && ($.grName.value = r.name || "");
  $?.grDescription && ($.grDescription.value = r.description || "");
  $?.grIsPublic && ($.grIsPublic.checked = r.isPublic === true);
  $?.grIsActive && ($.grIsActive.checked = r.isActive !== false);

  if ($?.grItems) $.grItems.innerHTML = "";

  const items = Array.isArray(r.exerciseItems) ? r.exerciseItems.slice() : [];
  items.sort((a,b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  if (!items.length) addRoutineItemRow();

  items.forEach((it) => addRoutineItemRow(it));
}

function addRoutineItemRow(existing) {
  if (!$?.grItems) return;

  const order = existing?.order ?? ($.grItems.children.length + 1);

  const rowId = `ri_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const exerciseOptions = _exercisesCache
    .map(ex => `<option value="${escapeHtml(ex.id)}">${escapeHtml(ex.name || "—")}</option>`)
    .join("");

  const html = `
    <div class="border rounded p-2 mb-2" data-ri-row="${rowId}">
      <div class="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
        <div class="fw-semibold">#<span data-ri-order>${order}</span></div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" type="button" data-ri-up>↑</button>
          <button class="btn btn-sm btn-outline-secondary" type="button" data-ri-down>↓</button>
          <button class="btn btn-sm btn-outline-danger" type="button" data-ri-del>Quitar</button>
        </div>
      </div>

      <div class="row g-2">
        <div class="col-12 col-lg-5">
          <label class="form-label small text-muted mb-1">Ejercicio</label>
          <select class="form-select form-select-sm" data-ri-ex required>
            <option value="">— Seleccioná —</option>
            ${exerciseOptions}
          </select>
        </div>

        <div class="col-6 col-lg-2">
          <label class="form-label small text-muted mb-1">Sets</label>
          <input class="form-control form-control-sm" data-ri-sets type="number" min="1" step="1" placeholder="(default)">
        </div>

        <div class="col-6 col-lg-2">
          <label class="form-label small text-muted mb-1">Reps</label>
          <input class="form-control form-control-sm" data-ri-reps placeholder="(default)">
        </div>

        <div class="col-6 col-lg-3">
          <label class="form-label small text-muted mb-1">Descanso (s)</label>
          <input class="form-control form-control-sm" data-ri-rest type="number" min="0" step="1" placeholder="(default)">
        </div>

        <div class="col-12">
          <label class="form-label small text-muted mb-1">Notas (override)</label>
          <input class="form-control form-control-sm" data-ri-notes placeholder="(default)">
        </div>
      </div>
    </div>
  `;

  $?.grItems?.insertAdjacentHTML("beforeend", html);

  const row = $?.grItems?.querySelector(`[data-ri-row="${rowId}"]`);
  if (!row) return;

  // fill existing
  if (existing?.exerciseId) row.querySelector("[data-ri-ex]").value = existing.exerciseId;
  if (existing?.sets !== null && existing?.sets !== undefined) row.querySelector("[data-ri-sets]").value = existing.sets;
  if (existing?.reps !== null && existing?.reps !== undefined) row.querySelector("[data-ri-reps]").value = String(existing.reps);
  if (existing?.restSec !== null && existing?.restSec !== undefined) row.querySelector("[data-ri-rest]").value = existing.restSec;
  if (existing?.notes) row.querySelector("[data-ri-notes]").value = existing.notes;

  // bind controls
  row.querySelector("[data-ri-del]").addEventListener("click", () => {
    row.remove();
    renumberRoutineItems();
  });

  row.querySelector("[data-ri-up]").addEventListener("click", () => {
    const prev = row.previousElementSibling;
    if (prev) row.parentElement.insertBefore(row, prev);
    renumberRoutineItems();
  });

  row.querySelector("[data-ri-down]").addEventListener("click", () => {
    const next = row.nextElementSibling;
    if (next) row.parentElement.insertBefore(next, row);
    renumberRoutineItems();
  });

  renumberRoutineItems();
}

function renumberRoutineItems() {
  if (!$?.grItems) return;
  [...$.grItems.children].forEach((el, idx) => {
    const span = el.querySelector("[data-ri-order]");
    if (span) span.textContent = String(idx + 1);
  });
}

async function onSaveRoutine(ev) {
  ev.preventDefault();

  try {
    const uid = requireEdit();
    clearAlert($?.rtAlert);

    const mode = $?.rtModal?.getAttribute("data-mode") || "new";
    const editId = $?.rtModal?.getAttribute("data-edit-id") || null;

    const payload = readRoutinePayload(uid);

    if (!payload.name) {
      showAlert($?.rtAlert, "El nombre es requerido.", "warning");
      return;
    }
    if (!payload.exerciseItems.length) {
      showAlert($?.rtAlert, "Agregá al menos 1 ejercicio.", "warning");
      return;
    }

    if (mode === "edit" && editId) {
      await updateDoc(doc(_ctx.db, COL_ROUTINES, editId), {
        ...payload,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    } else {
      await addDoc(collection(_ctx.db, COL_ROUTINES), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
        updatedBy: uid,
      });
    }

    hideModal($?.rtModal);

    await refreshRoutinesCache();
    window.dispatchEvent(new Event("gym:routinesChanged"));
  } catch (e) {
    console.error("SAVE ROUTINE ERROR:", e);
    showAlert($?.rtAlert, e?.message || "Error guardando rutina.", "danger");
  }
}

function readRoutinePayload(uid) {
  const name = trim($?.grName?.value);
  const description = toStringOrNull($?.grDescription?.value);
  const isPublic = !!$?.grIsPublic?.checked;
  const isActive = !!$?.grIsActive?.checked;

  const exerciseItems = readRoutineItemsFromUI();

  return {
    clubId: _ctx.clubId,
    name,
    description,
    isPublic,
    isActive,
    exerciseItems,
  };
}

function readRoutineItemsFromUI() {
  if (!$?.grItems) return [];
  const rows = [...$.grItems.querySelectorAll("[data-ri-row]")];

  return rows
    .map((row, idx) => {
      const exerciseId = row.querySelector("[data-ri-ex]")?.value || null;
      const sets = toNumberOrNull(row.querySelector("[data-ri-sets]")?.value);
      const reps = toStringOrNull(row.querySelector("[data-ri-reps]")?.value);
      const restSec = toNumberOrNull(row.querySelector("[data-ri-rest]")?.value);
      const notes = toStringOrNull(row.querySelector("[data-ri-notes]")?.value);

      if (!exerciseId) return null;

      // Si el usuario deja vacío -> guardamos null (para usar defaults del ejercicio)
      return {
        order: idx + 1,
        exerciseId,
        seriesType: null,
        sets: sets ?? null,
        reps: reps ?? null,
        restSec: restSec ?? null,
        distance: null,
        distanceUnit: null,
        notes: notes ?? null,
      };
    })
    .filter(Boolean);
}

/* =========================
   WEEK: Open / Fill / Save
========================= */
async function openWeekModal({ mode, id }) {
  clearAlert($?.wkAlert);
  resetWeekForm();

  await refreshRoutinesCache();
  fillWeekRoutinesSelect();

  $?.wkModal?.setAttribute("data-mode", mode);
  if (mode === "edit" && id) $?.wkModal?.setAttribute("data-edit-id", id);
  else $?.wkModal?.removeAttribute("data-edit-id");

  document.getElementById("gymWeekModalTitle").textContent =
    mode === "edit" ? "Editar semana" : "Crear semana";

  if (mode === "edit" && id) {
    await loadWeekToForm(id);
  }

  showModal($?.wkModal);
}

function resetWeekForm() {
  $?.wkForm?.reset?.();
  if ($?.gwIsActive) $.gwIsActive.checked = true;
  if ($?.gwRoutineIds) $.gwRoutineIds.innerHTML = "";
}

function fillWeekRoutinesSelect() {
  if (!$?.gwRoutineIds) return;

  $.gwRoutineIds.innerHTML = _routinesCache
    .map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name || "—")}</option>`)
    .join("");
}

async function loadWeekToForm(id) {
  const snap = await getDoc(doc(_ctx.db, COL_WEEKS, id));
  if (!snap.exists()) throw new Error("Semana no existe");
  const w = snap.data() || {};

  $?.gwName && ($.gwName.value = w.name || "");
  $?.gwDescription && ($.gwDescription.value = w.description || "");
  $?.gwIsActive && ($.gwIsActive.checked = w.isActive !== false);

  // fechas opcionales (guardamos string YYYY-MM-DD)
  if ($?.gwStart) $.gwStart.value = w.startDate || "";
  if ($?.gwEnd) $.gwEnd.value = w.endDate || "";

  // rutinaIds array
  const ids = Array.isArray(w.routineIds) ? w.routineIds : [];
  if ($?.gwRoutineIds) {
    [...$.gwRoutineIds.options].forEach(opt => {
      opt.selected = ids.includes(opt.value);
    });
  }
}

async function onSaveWeek(ev) {
  ev.preventDefault();

  try {
    const uid = requireEdit();
    clearAlert($?.wkAlert);

    const mode = $?.wkModal?.getAttribute("data-mode") || "new";
    const editId = $?.wkModal?.getAttribute("data-edit-id") || null;

    const payload = readWeekPayload(uid);

    if (!payload.name) {
      showAlert($?.wkAlert, "El nombre es requerido.", "warning");
      return;
    }

    if (mode === "edit" && editId) {
      await updateDoc(doc(_ctx.db, COL_WEEKS, editId), {
        ...payload,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    } else {
      await addDoc(collection(_ctx.db, COL_WEEKS), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
        updatedBy: uid,
      });
    }

    hideModal($?.wkModal);

    await refreshRoutinesCache();
    window.dispatchEvent(new Event("gym:weeksChanged"));
  } catch (e) {
    console.error("SAVE WEEK ERROR:", e);
    showAlert($?.wkAlert, e?.message || "Error guardando semana.", "danger");
  }
}

function readWeekPayload(uid) {
  const name = trim($?.gwName?.value);
  const description = toStringOrNull($?.gwDescription?.value);
  const startDate = toStringOrNull($?.gwStart?.value); // YYYY-MM-DD
  const endDate = toStringOrNull($?.gwEnd?.value);

  const routineIds = $?.gwRoutineIds
    ? [...$.gwRoutineIds.selectedOptions].map(o => o.value)
    : [];

  const isActive = !!$?.gwIsActive?.checked;

  return {
    clubId: _ctx.clubId,
    name,
    description,
    startDate,
    endDate,
    routineIds,
    isActive,
  };
}

/* =========================
   Cache for selectors
========================= */
async function refreshExercisesCache() {
  if (!_ctx.db) return;
  const qy = query(collection(_ctx.db, COL_EXERCISES), where("clubId", "==", _ctx.clubId));
  const snap = await getDocs(qy);
  _exercisesCache = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(x => x.isActive !== false);
  _exercisesCache.sort((a,b) => norm(a.name).localeCompare(norm(b.name)));
}

async function refreshRoutinesCache() {
  if (!_ctx.db) return;
  const qy = query(collection(_ctx.db, COL_ROUTINES), where("clubId", "==", _ctx.clubId));
  const snap = await getDocs(qy);
  _routinesCache = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(x => x.isActive !== false);
  _routinesCache.sort((a,b) => norm(a.name).localeCompare(norm(b.name)));
}

/* =========================
   Bootstrap modal helpers
========================= */
function showModal(el) {
  if (!el) return;
  const m = window.bootstrap?.Modal?.getOrCreateInstance(el, { backdrop: "static" });
  m?.show();
}
function hideModal(el) {
  if (!el) return;
  const m = window.bootstrap?.Modal?.getInstance(el) || window.bootstrap?.Modal?.getOrCreateInstance(el);
  m?.hide();
}

/* =========================
   Alerts
========================= */
function showAlert(el, msg, type="info") {
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("d-none");
}
function clearAlert(el) {
  el?.classList?.add("d-none");
}

/* =========================
   Utils
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}
function trim(v) {
  const s = (v || "").toString().trim();
  return s;
}
function toStringOrNull(v) {
  const s = (v ?? "").toString().trim();
  return s ? s : null;
}
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function parseCSV(v) {
  const s = (v || "").toString().trim();
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
}
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}