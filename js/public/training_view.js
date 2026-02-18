// /js/public/training_view.js
import { db } from "../firebase.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  documentId
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const TRAININGS_COL = "playbook_trainings";
const DRILLS_COL = "drills";

const $ = (id) => document.getElementById(id);

const tvTitle = $("tvTitle");
const tvSubtitle = $("tvSubtitle");
const tvDate = $("tvDate");
const tvNotes = $("tvNotes");
const tvPublicState = $("tvPublicState");
const tvError = $("tvError");
const tvDrills = $("tvDrills");
const tvEmpty = $("tvEmpty");
const tvShareBtn = $("tvShareBtn");

function showError(msg) {
  if (!tvError) return;
  tvError.textContent = msg;
  tvError.classList.remove("d-none");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchDrillsByIds(ids) {
  // Firestore "in" admite max 10
  const chunks = chunk(ids, 10);
  const results = new Map();

  for (const c of chunks) {
    const qy = query(collection(db, DRILLS_COL), where(documentId(), "in", c));
    const snap = await getDocs(qy);
    snap.forEach(d => results.set(d.id, { id: d.id, ...d.data() }));
  }

  // mantener el orden original de ids
  return ids.map(id => results.get(id)).filter(Boolean);
}

function drillCard(d) {
  const name = d?.name || "—";
  const author = d?.author || "—";
  const objective = d?.objective || "";
  const tactical = d?.tacticalUrl || "";
  const video = d?.videoUrl || "";

  const links = [
    tactical ? `<a class="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener" href="${escapeHtml(tactical)}">Tactical</a>` : "",
    video ? `<a class="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener" href="${escapeHtml(video)}">Video</a>` : ""
  ].filter(Boolean).join(" ");

  return `
    <div class="col-12 col-lg-6">
      <div class="card h-100 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold">${escapeHtml(name)}</div>
              <div class="text-muted small">Autor: ${escapeHtml(author)}</div>
            </div>
          </div>

          ${objective ? `<div class="text-muted small mt-2">${escapeHtml(objective)}</div>` : ""}

          ${links ? `<div class="d-flex gap-2 mt-3 flex-wrap">${links}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

(async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get("id") || "").trim();

  if (!id) {
    showError("Falta el parámetro id. Ej: training.html?id=XXXX");
    return;
  }

  tvShareBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      tvShareBtn.textContent = "Link copiado ✅";
      setTimeout(() => (tvShareBtn.textContent = "Compartir"), 1200);
    } catch {
      alert("No pude copiar el link. Copialo manualmente de la barra.");
    }
  });

  showLoader();
  try {
    const snap = await getDoc(doc(db, TRAININGS_COL, id));
    if (!snap.exists()) {
      showError("No se encontró este entrenamiento.");
      return;
    }

    const t = { id: snap.id, ...snap.data() };

    if (t.isPublic !== true) {
      showError("Este entrenamiento es privado.");
      return;
    }

    if (tvTitle) tvTitle.textContent = t.name || "Entrenamiento";
    if (tvSubtitle) tvSubtitle.textContent = "Volcanes Ultimate";
    if (tvDate) tvDate.textContent = t.date || "—";
    if (tvNotes) tvNotes.textContent = t.notes || "—";
    if (tvPublicState) tvPublicState.textContent = "Público";

    const ids = Array.isArray(t.drillIds) ? t.drillIds.filter(Boolean) : [];
    if (!ids.length) {
      tvEmpty?.classList.remove("d-none");
      return;
    }

    const drills = await fetchDrillsByIds(ids);
    tvDrills.innerHTML = drills.length ? drills.map(drillCard).join("") : "";
    tvEmpty?.classList.toggle("d-none", drills.length > 0);
  } catch (e) {
    console.error(e);
    showError("Error cargando el entrenamiento.");
  } finally {
    hideLoader();
  }
})();
