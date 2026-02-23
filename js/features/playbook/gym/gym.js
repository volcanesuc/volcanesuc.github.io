// js/features/playbook/gym/gym.js
import { loadPartialOnce } from "../../../ui/loadPartial.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Collections
========================= */
const COL_EX = "gym_exercises";
const COL_ROUT = "gym_routines";
const COL_WEEK = "gym_weeks";

/* =========================
   State
========================= */
let S = {
  db: null,
  clubId: "volcanes",
  canEdit: false,
  modalMountId: "modalMount",
  $: {},
  exercises: [],
  routines: [],
  weeks: [],
};

/* =========================
   Public API
========================= */
export async function initGymTab({ db, clubId, canEdit, modalMountId = "modalMount" }) {
  S.db = db;
  S.clubId = clubId || "volcanes";
  S.canEdit = !!canEdit;
  S.modalMountId = modalMountId;

  cacheDom();
  bindEvents();

  await reloadAll();
  renderAll();
}

/* =========================
   DOM
========================= */
function cacheDom() {
  S.$ = {
    refreshGymBtn: document.getElementById("refreshGymBtn"),

    openCreateGymExerciseBtn: document.getElementById("openCreateGymExerciseBtn"),
    openCreateGymRoutineBtn: document.getElementById("openCreateGymRoutineBtn"),
    openCreateGymWeekBtn: document.getElementById("openCreateGymWeekBtn"),

    gymExerciseSearch: document.getElementById("gymExerciseSearch"),
    gymRoutineSearch: document.getElementById("gymRoutineSearch"),
    gymWeekSearch: document.getElementById("gymWeekSearch"),

    gymExercisesList: document.getElementById("gymExercisesList"),
    gymRoutinesList: document.getElementById("gymRoutinesList"),
    gymWeeksList: document.getElementById("gymWeeksList"),

    gymExercisesEmpty: document.getElementById("gymExercisesEmpty"),
    gymRoutinesEmpty: document.getElementById("gymRoutinesEmpty"),
    gymWeeksEmpty: document.getElementById("gymWeeksEmpty"),
  };

  // botones admin
  if (S.canEdit) {
    S.$.openCreateGymExerciseBtn?.classList.remove("d-none");
    S.$.openCreateGymRoutineBtn?.classList.remove("d-none");
    S.$.openCreateGymWeekBtn?.classList.remove("d-none");
  } else {
    S.$.openCreateGymExerciseBtn?.classList.add("d-none");
    S.$.openCreateGymRoutineBtn?.classList.add("d-none");
    S.$.openCreateGymWeekBtn?.classList.add("d-none");
  }
}

function bindEvents() {
  S.$.refreshGymBtn?.addEventListener("click", async () => {
    await reloadAll();
    renderAll();
  });

  S.$.gymExerciseSearch?.addEventListener("input", renderExercises);
  S.$.gymRoutineSearch?.addEventListener("input", renderRoutines);
  S.$.gymWeekSearch?.addEventListener("input", renderWeeks);

  S.$.openCreateGymExerciseBtn?.addEventListener("click", () => openExerciseModal(null));
  S.$.openCreateGymRoutineBtn?.addEventListener("click", () => openRoutineModal(null));
  S.$.openCreateGymWeekBtn?.addEventListener("click", () => openWeekModal(null));
}

/* =========================
   Load
========================= */
async function reloadAll() {
  await Promise.all([loadExercises(), loadRoutines(), loadWeeks()]);
}

async function loadExercises() {
  const qy = query(
    collection(S.db, COL_EX),
    where("clubId", "==", S.clubId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(qy);
  S.exercises = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  S.exercises.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

async function loadRoutines() {
  const qy = query(
    collection(S.db, COL_ROUT),
    where("clubId", "==", S.clubId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(qy);
  S.routines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  S.routines.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

async function loadWeeks() {
  const qy = query(
    collection(S.db, COL_WEEK),
    where("clubId", "==", S.clubId),
    where("isActive", "==", true)
  );
  const snap = await getDocs(qy);
  S.weeks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // latest first by startDate
  S.weeks.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
}

function renderAll() {
  renderExercises();
  renderRoutines();
  renderWeeks();
}

/* =========================
   Render: Exercises
========================= */
function renderExercises() {
  const term = norm(S.$.gymExerciseSearch?.value);
  const list = term
    ? S.exercises.filter(x => norm(x.name).includes(term))
    : S.exercises;

  if (!S.$.gymExercisesList) return;
  S.$.gymExercisesList.innerHTML = "";

  if (!list.length) {
    S.$.gymExercisesEmpty?.classList.remove("d-none");
    return;
  }
  S.$.gymExercisesEmpty?.classList.add("d-none");

  list.forEach(ex => {
    const parts = Array.isArray(ex.bodyParts) ? ex.bodyParts.join(", ") : "—";
    const hasVideo = !!(ex.videoUrl || "").trim();
    const pub = ex.isPublic === true;

    const item = document.createElement("div");
    item.className = "list-group-item";

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(ex.name || "—")}</div>
          <div class="text-muted small">${escapeHtml(parts)}</div>
          <div class="text-muted small">${pub ? "🌐 Público" : "🔒 Privado"}</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          ${hasVideo ? `<a class="btn btn-sm btn-outline-secondary" href="${escapeHtml(ex.videoUrl)}" target="_blank" rel="noopener">Video</a>` : ``}
          ${S.canEdit ? `<button class="btn btn-sm btn-primary" data-edit-ex="${escapeHtml(ex.id)}">Editar</button>` : ``}
        </div>
      </div>
    `;

    S.$.gymExercisesList.appendChild(item);
  });

  if (S.canEdit) {
    S.$.gymExercisesList.querySelectorAll("[data-edit-ex]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-ex");
        if (!id) return;
        await openExerciseModal(id);
      });
    });
  }
}

/* =========================
   Render: Routines
========================= */
function renderRoutines() {
  const term = norm(S.$.gymRoutineSearch?.value);
  const list = term
    ? S.routines.filter(x => norm(x.name).includes(term))
    : S.routines;

  if (!S.$.gymRoutinesList) return;
  S.$.gymRoutinesList.innerHTML = "";

  if (!list.length) {
    S.$.gymRoutinesEmpty?.classList.remove("d-none");
    return;
  }
  S.$.gymRoutinesEmpty?.classList.add("d-none");

  list.forEach(r => {
    const count = Array.isArray(r.exerciseItems) ? r.exerciseItems.length : 0;
    const pub = r.isPublic === true;

    const item = document.createElement("div");
    item.className = "list-group-item";

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(r.name || "—")}</div>
          <div class="text-muted small">${count} ejercicio(s) · ${pub ? "🌐 Pública" : "🔒 Privada"}</div>
        </div>
        <div class="d-flex gap-2">
          ${S.canEdit ? `<button class="btn btn-sm btn-primary" data-edit-r="${escapeHtml(r.id)}">Editar</button>` : ``}
        </div>
      </div>
    `;

    S.$.gymRoutinesList.appendChild(item);
  });

  if (S.canEdit) {
    S.$.gymRoutinesList.querySelectorAll("[data-edit-r]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-r");
        if (!id) return;
        await openRoutineModal(id);
      });
    });
  }
}

/* =========================
   Render: Weeks (share link)
========================= */
function renderWeeks() {
  const term = norm(S.$.gymWeekSearch?.value);
  const list = term
    ? S.weeks.filter(x => norm(x.name).includes(term))
    : S.weeks;

  if (!S.$.gymWeeksList) return;
  S.$.gymWeeksList.innerHTML = "";

  if (!list.length) {
    S.$.gymWeeksEmpty?.classList.remove("d-none");
    return;
  }
  S.$.gymWeeksEmpty?.classList.add("d-none");

  list.forEach(w => {
    const slotCount = Array.isArray(w.slots) ? w.slots.length : 0;
    const pub = w.isPublic === true;
    const sharePath = `/gym_week.html?id=${encodeURIComponent(w.id)}`;

    const item = document.createElement("div");
    item.className = "list-group-item";

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-semibold">${escapeHtml(w.name || "—")}</div>
          <div class="text-muted small">${escapeHtml(w.startDate || "—")} → ${escapeHtml(w.endDate || "—")} · ${slotCount} rutina(s)</div>
          <div class="text-muted small">${pub ? "🌐 Compartible" : "🔒 Privada"}</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          ${pub ? `<a class="btn btn-sm btn-outline-secondary" href="${sharePath}" target="_blank" rel="noopener">Ver</a>` : ``}
          ${pub ? `<button class="btn btn-sm btn-outline-primary" data-copy-week="${escapeHtml(sharePath)}">Copiar link</button>` : ``}
          ${S.canEdit ? `<button class="btn btn-sm btn-primary" data-edit-w="${escapeHtml(w.id)}">Editar</button>` : ``}
        </div>
      </div>
    `;

    S.$.gymWeeksList.appendChild(item);
  });

  // copy link
  S.$.gymWeeksList.querySelectorAll("[data-copy-week]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const path = btn.getAttribute("data-copy-week");
      if (!path) return;
      const url = `${window.location.origin}${path}`;
      try {
        await navigator.clipboard.writeText(url);
        const old = btn.textContent;
        btn.textContent = "Copiado ✅";
        setTimeout(() => (btn.textContent = old), 1200);
      } catch {
        alert("No pude copiar. Link:\n" + url);
      }
    });
  });

  if (S.canEdit) {
    S.$.gymWeeksList.querySelectorAll("[data-edit-w]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-w");
        if (!id) return;
        await openWeekModal(id);
      });
    });
  }
}

/* =========================
   MODAL: Exercise
========================= */
async function openExerciseModal(editId) {
  if (!S.canEdit) return;

  await loadPartialOnce("/partials/gym_exercise_modal.html", S.modalMountId);

  const modalEl = document.getElementById("gymExerciseModal");
  const titleEl = document.getElementById("gymExerciseModalTitle");
  const alertEl = document.getElementById("gymExerciseAlert");

  const geName = document.getElementById("geName");
  const geSeriesType = document.getElementById("geSeriesType");
  const geSets = document.getElementById("geSets");
  const geReps = document.getElementById("geReps");
  const geDistance = document.getElementById("geDistance");
  const geDistanceUnit = document.getElementById("geDistanceUnit");
  const geBodyParts = document.getElementById("geBodyParts");
  const geVideoUrl = document.getElementById("geVideoUrl");
  const geNotes = document.getElementById("geNotes");
  const geIsPublic = document.getElementById("geIsPublic");

  const repsWrap = document.getElementById("geRepsWrap");
  const distWrap = document.getElementById("geDistanceWrap");

  const saveBtn = document.getElementById("saveGymExerciseBtn");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  const showAlert = (msg, type = "warning") => {
    if (!alertEl) return;
    alertEl.className = `alert alert-${type}`;
    alertEl.textContent = msg;
    alertEl.classList.remove("d-none");
  };
  const clearAlert = () => alertEl?.classList.add("d-none");

  const syncSeriesUi = () => {
    const t = geSeriesType?.value || "reps";
    if (t === "distance") {
      repsWrap?.classList.add("d-none");
      distWrap?.classList.remove("d-none");
    } else {
      repsWrap?.classList.remove("d-none");
      distWrap?.classList.add("d-none");
    }
  };

  // bind change (solo una vez por apertura)
  geSeriesType?.addEventListener("change", syncSeriesUi);

  clearAlert();

  // preload
  if (editId) {
    titleEl && (titleEl.textContent = "Editar ejercicio");

    const snap = await getDoc(doc(S.db, COL_EX, editId));
    const ex = snap.exists() ? snap.data() : null;
    if (!ex) {
      showAlert("No encontré el ejercicio.", "danger");
      return;
    }

    geName.value = ex.name || "";
    geSeriesType.value = ex.seriesType || "reps";
    geSets.value = ex.sets ?? "";
    geReps.value = ex.reps ?? "";
    geDistance.value = ex.distance ?? "";
    geDistanceUnit.value = ex.distanceUnit || "m";
    geBodyParts.value = Array.isArray(ex.bodyParts) ? ex.bodyParts.join(", ") : "";
    geVideoUrl.value = ex.videoUrl || "";
    geNotes.value = ex.notes || "";
    geIsPublic.checked = ex.isPublic === true;
  } else {
    titleEl && (titleEl.textContent = "Crear ejercicio");
    geName.value = "";
    geSeriesType.value = "reps";
    geSets.value = "";
    geReps.value = "";
    geDistance.value = "";
    geDistanceUnit.value = "m";
    geBodyParts.value = "";
    geVideoUrl.value = "";
    geNotes.value = "";
    geIsPublic.checked = true;
  }

  syncSeriesUi();

  // bind save (evitar doble bind)
  if (!openExerciseModal._bound) {
    saveBtn?.addEventListener("click", async () => {
      clearAlert();

      const name = (geName?.value || "").trim();
      if (!name) return showAlert("Nombre requerido.");

      const seriesType = geSeriesType?.value || "reps";
      const sets = numOrNull(geSets?.value);

      const reps = seriesType === "reps" ? numOrNull(geReps?.value) : null;
      const distance = seriesType === "distance" ? numOrNull(geDistance?.value) : null;
      const distanceUnit = seriesType === "distance" ? (geDistanceUnit?.value || "m") : null;

      const bodyParts = (geBodyParts?.value || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        clubId: S.clubId,
        name,
        seriesType,
        sets: sets ?? null,
        reps: reps ?? null,
        distance: distance ?? null,
        distanceUnit,
        bodyParts,
        videoUrl: (geVideoUrl?.value || "").trim(),
        notes: (geNotes?.value || "").trim(),
        isPublic: geIsPublic?.checked === true,
        isActive: true,
        updatedAt: serverTimestamp(),
      };

      try {
        if (openExerciseModal._editId) {
          await setDoc(doc(S.db, COL_EX, openExerciseModal._editId), payload, { merge: true });
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(S.db, COL_EX), payload);
        }

        modal.hide();
        await reloadAll();
        renderAll();
      } catch (e) {
        console.error(e);
        showAlert("Error guardando ejercicio. Ver consola.", "danger");
      }
    });

    openExerciseModal._bound = true;
  }

  openExerciseModal._editId = editId || null;
  modal.show();
}

/* =========================
   MODAL: Routine
========================= */
async function openRoutineModal(editId) {
  if (!S.canEdit) return;

  await loadPartialOnce("/partials/gym_routine_editor.html", S.modalMountId);

  const modalEl = document.getElementById("gymRoutineModal");
  const titleEl = document.getElementById("gymRoutineModalTitle");
  const alertEl = document.getElementById("gymRoutineAlert");

  const grName = document.getElementById("grName");
  const grDescription = document.getElementById("grDescription");
  const grIsPublic = document.getElementById("grIsPublic");

  const addSelect = document.getElementById("grAddExerciseSelect");
  const addBtn = document.getElementById("grAddExerciseBtn");
  const tbody = document.getElementById("grItemsTbody");
  const saveBtn = document.getElementById("saveGymRoutineBtn");

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  const showAlert = (msg, type = "warning") => {
    alertEl.className = `alert alert-${type}`;
    alertEl.textContent = msg;
    alertEl.classList.remove("d-none");
  };
  const clearAlert = () => alertEl?.classList.add("d-none");

  // local state
  let items = []; // {exerciseId, order, sets, reps, distance, restSec, notes}

  const byId = Object.fromEntries(S.exercises.map(x => [x.id, x]));

  function fillExerciseSelect() {
    if (!addSelect) return;
    addSelect.innerHTML = S.exercises
      .map(ex => `<option value="${escapeHtml(ex.id)}">${escapeHtml(ex.name || "—")}</option>`)
      .join("");
  }

  function renderItems() {
    if (!tbody) return;
    tbody.innerHTML = "";

    items
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((it, idx) => {
        const ex = byId[it.exerciseId];
        const exName = ex?.name || "—";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(exName)}</div>
            <div class="text-muted small">${escapeHtml((ex?.bodyParts || []).join(", ") || "")}</div>
          </td>
          <td><input class="form-control form-control-sm" data-k="sets" value="${it.sets ?? ""}"></td>
          <td><input class="form-control form-control-sm" data-k="reps" value="${it.reps ?? ""}"></td>
          <td><input class="form-control form-control-sm" data-k="distance" value="${escapeHtml(it.distance ?? "")}" placeholder="400m"></td>
          <td><input class="form-control form-control-sm" data-k="restSec" value="${it.restSec ?? ""}"></td>
          <td><input class="form-control form-control-sm" data-k="notes" value="${escapeHtml(it.notes ?? "")}"></td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary" data-act="up">↑</button>
            <button class="btn btn-sm btn-outline-secondary" data-act="down">↓</button>
            <button class="btn btn-sm btn-outline-danger" data-act="del">Quitar</button>
          </td>
        `;

        // inputs
        tr.querySelectorAll("input[data-k]").forEach(inp => {
          inp.addEventListener("input", () => {
            const k = inp.getAttribute("data-k");
            const v = inp.value;

            if (k === "notes") it.notes = v;
            else if (k === "sets") it.sets = numOrNull(v);
            else if (k === "reps") it.reps = numOrNull(v);
            else if (k === "restSec") it.restSec = numOrNull(v);
            else if (k === "distance") it.distance = v.trim() ? v.trim() : null;
          });
        });

        tr.querySelectorAll("button[data-act]").forEach(btn => {
          btn.addEventListener("click", () => {
            const act = btn.getAttribute("data-act");
            if (act === "del") {
              items = items.filter(x => x !== it);
              items.forEach((x, i) => (x.order = i + 1));
              renderItems();
            }
            if (act === "up" && idx > 0) {
              const tmp = items[idx - 1];
              items[idx - 1] = items[idx];
              items[idx] = tmp;
              items.forEach((x, i) => (x.order = i + 1));
              renderItems();
            }
            if (act === "down" && idx < items.length - 1) {
              const tmp = items[idx + 1];
              items[idx + 1] = items[idx];
              items[idx] = tmp;
              items.forEach((x, i) => (x.order = i + 1));
              renderItems();
            }
          });
        });

        tbody.appendChild(tr);
      });
  }

  fillExerciseSelect();
  clearAlert();

  if (editId) {
    titleEl && (titleEl.textContent = "Editar rutina");
    const snap = await getDoc(doc(S.db, COL_ROUT, editId));
    const data = snap.exists() ? snap.data() : null;
    if (!data) return showAlert("No encontré la rutina.", "danger");

    grName.value = data.name || "";
    grDescription.value = data.description || "";
    grIsPublic.checked = data.isPublic === true;

    items = Array.isArray(data.exerciseItems)
      ? data.exerciseItems.map((x, i) => ({
          exerciseId: x.exerciseId,
          order: x.order ?? (i + 1),
          sets: x.sets ?? null,
          reps: x.reps ?? null,
          distance: x.distance ?? null,
          restSec: x.restSec ?? null,
          notes: x.notes ?? "",
        }))
      : [];
    items.sort((a, b) => (a.order || 0) - (b.order || 0));
  } else {
    titleEl && (titleEl.textContent = "Crear rutina");
    grName.value = "";
    grDescription.value = "";
    grIsPublic.checked = true;
    items = [];
  }

  renderItems();

  if (!openRoutineModal._bound) {
    addBtn?.addEventListener("click", () => {
      const exId = addSelect?.value;
      if (!exId) return;
      items.push({
        exerciseId: exId,
        order: items.length + 1,
        sets: null,
        reps: null,
        distance: null,
        restSec: null,
        notes: "",
      });
      renderItems();
    });

    saveBtn?.addEventListener("click", async () => {
      clearAlert();
      const name = (grName?.value || "").trim();
      if (!name) return showAlert("Nombre requerido.");

      const payload = {
        clubId: S.clubId,
        name,
        description: (grDescription?.value || "").trim(),
        exerciseItems: items
          .map((x, i) => ({ ...x, order: i + 1 }))
          .filter(x => !!x.exerciseId),
        isPublic: grIsPublic?.checked === true,
        isActive: true,
        updatedAt: serverTimestamp(),
      };

      try {
        if (openRoutineModal._editId) {
          await setDoc(doc(S.db, COL_ROUT, openRoutineModal._editId), payload, { merge: true });
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(S.db, COL_ROUT), payload);
        }

        modal.hide();
        await reloadAll();
        renderAll();
      } catch (e) {
        console.error(e);
        showAlert("Error guardando rutina. Ver consola.", "danger");
      }
    });

    openRoutineModal._bound = true;
  }

  openRoutineModal._editId = editId || null;
  modal.show();
}

/* =========================
   MODAL: Week
========================= */
async function openWeekModal(editId) {
  if (!S.canEdit) return;

  await loadPartialOnce("/partials/gym_week_editor.html", S.modalMountId);

  const modalEl = document.getElementById("gymWeekModal");
  const titleEl = document.getElementById("gymWeekModalTitle");
  const alertEl = document.getElementById("gymWeekAlert");

  const gwName = document.getElementById("gwName");
  const gwStartDate = document.getElementById("gwStartDate");
  const gwEndDate = document.getElementById("gwEndDate");
  const gwIsPublic = document.getElementById("gwIsPublic");

  const slotLabel = document.getElementById("gwSlotLabel");
  const slotRoutineSelect = document.getElementById("gwSlotRoutineSelect");
  const addSlotBtn = document.getElementById("gwAddSlotBtn");
  const tbody = document.getElementById("gwSlotsTbody");
  const saveBtn = document.getElementById("saveGymWeekBtn");

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  const showAlert = (msg, type = "warning") => {
    alertEl.className = `alert alert-${type}`;
    alertEl.textContent = msg;
    alertEl.classList.remove("d-none");
  };
  const clearAlert = () => alertEl?.classList.add("d-none");

  let slots = []; // {label, routineId, order}

  function fillRoutineSelect() {
    if (!slotRoutineSelect) return;

    const wantsPublic = gwIsPublic?.checked === true;
    const list = wantsPublic ? S.routines.filter(r => r.isPublic === true) : S.routines;

    slotRoutineSelect.innerHTML = list
      .map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name || "—")}</option>`)
      .join("");
  }

  function routineName(id) {
    const r = S.routines.find(x => x.id === id);
    return r?.name || "—";
  }

  function renderSlots() {
    if (!tbody) return;
    tbody.innerHTML = "";

    slots
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((s, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td><input class="form-control form-control-sm" data-k="label" value="${escapeHtml(s.label || "")}"></td>
          <td>${escapeHtml(routineName(s.routineId))}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary" data-act="up">↑</button>
            <button class="btn btn-sm btn-outline-secondary" data-act="down">↓</button>
            <button class="btn btn-sm btn-outline-danger" data-act="del">Quitar</button>
          </td>
        `;

        tr.querySelector("input[data-k='label']")?.addEventListener("input", (e) => {
          s.label = e.target.value;
        });

        tr.querySelectorAll("button[data-act]").forEach(btn => {
          btn.addEventListener("click", () => {
            const act = btn.getAttribute("data-act");

            if (act === "del") {
              slots = slots.filter(x => x !== s);
              slots.forEach((x, i) => (x.order = i + 1));
              renderSlots();
            }

            if (act === "up" && idx > 0) {
              const tmp = slots[idx - 1];
              slots[idx - 1] = slots[idx];
              slots[idx] = tmp;
              slots.forEach((x, i) => (x.order = i + 1));
              renderSlots();
            }

            if (act === "down" && idx < slots.length - 1) {
              const tmp = slots[idx + 1];
              slots[idx + 1] = slots[idx];
              slots[idx] = tmp;
              slots.forEach((x, i) => (x.order = i + 1));
              renderSlots();
            }
          });
        });

        tbody.appendChild(tr);
      });
  }

  clearAlert();

  if (editId) {
    titleEl && (titleEl.textContent = "Editar semana");
    const snap = await getDoc(doc(S.db, COL_WEEK, editId));
    const data = snap.exists() ? snap.data() : null;
    if (!data) return showAlert("No encontré la semana.", "danger");

    gwName.value = data.name || "";
    gwStartDate.value = data.startDate || "";
    gwEndDate.value = data.endDate || "";
    gwIsPublic.checked = data.isPublic === true;

    slots = Array.isArray(data.slots)
      ? data.slots.map((x, i) => ({
          label: x.label || "",
          routineId: x.routineId || "",
          order: x.order ?? (i + 1),
        }))
      : [];
    slots.sort((a, b) => (a.order || 0) - (b.order || 0));
  } else {
    titleEl && (titleEl.textContent = "Crear semana");
    gwName.value = "";
    gwStartDate.value = "";
    gwEndDate.value = "";
    gwIsPublic.checked = true;
    slots = [];
  }

  fillRoutineSelect();
  renderSlots();

  // si cambia a pública/privada, refresca selector
  gwIsPublic?.addEventListener("change", fillRoutineSelect);

  if (!openWeekModal._bound) {
    addSlotBtn?.addEventListener("click", () => {
      const label = (slotLabel?.value || "").trim();
      const routineId = slotRoutineSelect?.value || "";

      if (!label) return showAlert("Etiqueta requerida (ej: Lunes AM).");
      if (!routineId) return showAlert("Seleccioná una rutina.");

      slots.push({ label, routineId, order: slots.length + 1 });
      slotLabel.value = "";
      renderSlots();
    });

    saveBtn?.addEventListener("click", async () => {
      clearAlert();

      const name = (gwName?.value || "").trim();
      if (!name) return showAlert("Nombre requerido.");

      const startDate = gwStartDate?.value || "";
      const endDate = gwEndDate?.value || "";
      if (startDate && endDate && endDate < startDate) {
        return showAlert("La fecha fin no puede ser menor que la fecha inicio.");
      }

      const wantsPublic = gwIsPublic?.checked === true;

      // si semana es pública, valida que rutinas referenciadas sean públicas
      if (wantsPublic) {
        const bad = slots.find(s => {
          const r = S.routines.find(x => x.id === s.routineId);
          return r && r.isPublic !== true;
        });
        if (bad) {
          return showAlert("La semana es pública pero incluye una rutina privada. Publicá la rutina o quitála.", "danger");
        }
      }

      const payload = {
        clubId: S.clubId,
        name,
        startDate,
        endDate,
        slots: slots.map((x, i) => ({ ...x, order: i + 1 })),
        isPublic: wantsPublic,
        isActive: true,
        updatedAt: serverTimestamp(),
      };

      try {
        if (openWeekModal._editId) {
          await setDoc(doc(S.db, COL_WEEK, openWeekModal._editId), payload, { merge: true });
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(S.db, COL_WEEK), payload);
        }

        modal.hide();
        await reloadAll();
        renderAll();
      } catch (e) {
        console.error(e);
        showAlert("Error guardando semana. Ver consola.", "danger");
      }
    });

    openWeekModal._bound = true;
  }

  openWeekModal._editId = editId || null;
  modal.show();
}

/* =========================
   Utils
========================= */
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}