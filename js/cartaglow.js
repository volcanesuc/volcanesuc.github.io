import { CARTAGLOW_DATA as D } from "./cartaglow_strings.js";

/* =========================
   Helpers
========================= */
function $(sel) { return document.querySelector(sel); }
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * CSV parser (soporta comillas, comas, \n)
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"'; // escape ""
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      // manejar \r\n
      if (ch === "\r" && next === "\n") i++;

      row.push(cur);
      cur = "";

      // evitar filas vacías
      const hasContent = row.some(v => String(v).trim() !== "");
      if (hasContent) rows.push(row);

      row = [];
      continue;
    }

    cur += ch;
  }

  // last
  row.push(cur);
  const hasContent = row.some(v => String(v).trim() !== "");
  if (hasContent) rows.push(row);

  return rows;
}

function normalizeKey(k) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("_", "");
}

function guessColumn(headers, candidates) {
  const map = headers.map(h => normalizeKey(h));
  for (const cand of candidates) {
    const c = normalizeKey(cand);
    const idx = map.findIndex(h => h.includes(c));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

/* =========================
   Meta
========================= */
document.title = D.meta?.title ?? "Cartaglow";

const ogImg = document.querySelector('meta[property="og:image"]');
if (ogImg && D.meta?.ogImage) ogImg.setAttribute("content", D.meta.ogImage);

/* =========================
   Header + Hero
========================= */
$("#cgClubName").textContent = D.header?.clubName ?? "Volcanes Ultimate";

const ig = $("#cgInstagramLink");
if (ig && D.header?.instagramUrl) ig.href = D.header.instagramUrl;

$("#cgEditionPill").textContent = D.hero?.editionPill ?? "Cartaglow";
$("#cgTitle").textContent = D.hero?.title ?? "Cartaglow";
$("#cgSubtitle").textContent = D.hero?.subtitle ?? "";

const heroImg = $("#cgHeroImage");
if (heroImg && D.hero?.image) heroImg.src = D.hero.image;

/* Registro (disabled ready) */
const regBtn = $("#cgRegisterBtn");
const regNote = $("#cgRegisterNote");
if (regBtn) {
  regBtn.textContent = D.registration?.ctaLabel ?? "Registrarse";

  const enabled = Boolean(D.registration?.enabled);
  const url = D.registration?.url ?? "#";

  if (!enabled) {
    regBtn.classList.add("cg-btn-disabled");
    regBtn.disabled = true;
    regBtn.title = "Próximamente";
    if (regNote) regNote.textContent = D.registration?.disabledNote ?? "";
  } else {
    regBtn.disabled = false;
    regBtn.addEventListener("click", () => window.open(url, "_blank", "noopener"));
    if (regNote) regNote.textContent = "";
  }
}

const calBtn = $("#cgAddToCalendarBtn");
if (calBtn && D.calendar?.addToCalendarUrl) calBtn.href = D.calendar.addToCalendarUrl;

/* =========================
   Info cards
========================= */
const infoWrap = $("#cgInfoCards");
if (infoWrap) {
  infoWrap.innerHTML = "";

  (D.infoCards || []).forEach(c => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-3";

    const clickable = c.link ? "clickable" : "";
    col.innerHTML = `
      <div class="cg-card ${clickable}" ${c.link ? `data-href="${escapeHtml(c.link)}"` : ""}>
        <i class="bi ${escapeHtml(c.icon || "bi-info-circle")}"></i>
        <h3>${escapeHtml(c.title || "")}</h3>
        <p>${(c.lines || []).map(escapeHtml).join("<br>")}</p>
      </div>
    `;

    infoWrap.appendChild(col);
  });

  // click handler
  infoWrap.querySelectorAll(".cg-card.clickable").forEach(card => {
    card.addEventListener("click", () => {
      const href = card.getAttribute("data-href");
      if (href) window.open(href, "_blank", "noopener");
    });
  });
}

/* =========================
   Testimonials
========================= */
$("#cgTestimonialsTitle").textContent = D.testimonials?.title ?? "Testimonios";
$("#cgTestimonialsSubtitle").textContent = D.testimonials?.subtitle ?? "";

const tWrap = $("#cgTestimonials");
if (tWrap) {
  tWrap.innerHTML = "";

  (D.testimonials?.items || []).forEach(t => {
    const col = document.createElement("div");
    col.className = "col-12 col-lg-6";

    const lines = (t.text || []).map(line => `<div class="mb-2">“${escapeHtml(line)}”</div>`).join("");

    col.innerHTML = `
      <div class="cg-quote">
        ${lines}
        <div class="who">${escapeHtml(t.author || "")}</div>
        <div class="cg-muted">${escapeHtml(t.source || "")}</div>
      </div>
    `;

    tWrap.appendChild(col);
  });
}

/* =========================
   Showcase
========================= */
$("#cgShowcaseTitle").textContent = D.showcase?.title ?? "Showcase";
$("#cgShowcaseText").textContent = D.showcase?.text ?? "";
$("#cgShowcaseCredit").textContent = D.showcase?.credit ?? "";

const albumLink = $("#cgShowcaseLink");
if (albumLink && D.showcase?.albumUrl) albumLink.href = D.showcase.albumUrl;

const gallery = $("#cgGallery");
if (gallery) {
  gallery.innerHTML = "";
  (D.showcase?.thumbs || []).slice(0, 6).forEach(src => {
    const img = document.createElement("img");
    img.className = "cg-thumb";
    img.src = src;
    img.alt = "Cartaglow";
    gallery.appendChild(img);
  });
}

/* =========================
   Stats 2024 (CSV)
========================= */
$("#cgStatsTitle").textContent = D.stats2024?.title ?? "Stats";
$("#cgStatsSubtitle").textContent = D.stats2024?.subtitle ?? "";

const sourceLink = $("#cgStatsSourceLink");
if (sourceLink && D.stats2024?.sourceUrl) sourceLink.href = D.stats2024.sourceUrl;

$("#cgStatsFootnote").textContent = D.stats2024?.footnote ?? "";

async function loadStats() {
  const csvUrl = D.stats2024?.csvUrl;
  if (!csvUrl) return;

  const headEl = $("#cgStatsHead");
  const bodyEl = $("#cgStatsBody");
  const kpisEl = $("#cgStatsKpis");

  if (!headEl || !bodyEl || !kpisEl) return;

  // loading placeholders
  headEl.innerHTML = `<th>Cargando…</th>`;
  bodyEl.innerHTML = "";
  kpisEl.innerHTML = "";

  let text;
  try {
    const res = await fetch(csvUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    headEl.innerHTML = `<th>Error</th>`;
    bodyEl.innerHTML = `<tr><td>No se pudo cargar el CSV. Revisa el link o CORS.</td></tr>`;
    return;
  }

  const rows = parseCSV(text);
  if (!rows.length) {
    headEl.innerHTML = `<th>Vacío</th>`;
    bodyEl.innerHTML = `<tr><td>El CSV está vacío.</td></tr>`;
    return;
  }

  const headers = rows[0].map(h => String(h ?? "").trim());
  const dataRows = rows.slice(1);

  // columnas visibles
  const visible = Array.isArray(D.stats2024?.visibleColumns) && D.stats2024.visibleColumns.length
    ? D.stats2024.visibleColumns.filter(c => headers.includes(c))
    : headers;

  const visibleIdx = visible.map(col => headers.indexOf(col)).filter(i => i >= 0);

  // render head
  headEl.innerHTML = visible.map(h => `<th>${escapeHtml(h)}</th>`).join("");

  // render body (limit 500 filas por performance)
  const limit = Math.min(dataRows.length, 500);
  bodyEl.innerHTML = dataRows.slice(0, limit).map(r => {
    const tds = visibleIdx.map(i => `<td>${escapeHtml(r[i] ?? "")}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  // KPIs
  const kpis = D.stats2024?.kpis || [];
  const buildKpi = (label, value) => `
    <div class="col-12 col-md-4">
      <div class="cg-kpi">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${escapeHtml(value)}</div>
      </div>
    </div>
  `;

  const kpiHtml = [];

  kpis.forEach(k => {
    if (k.type === "rows") {
      kpiHtml.push(buildKpi(k.label || "Filas", String(dataRows.length)));
      return;
    }

    if (k.type === "unique") {
      const col =
        k.column ||
        guessColumn(headers, k.columnGuess || []);

      if (!col) return;

      const idx = headers.indexOf(col);
      const set = new Set(
        dataRows
          .map(r => String(r[idx] ?? "").trim())
          .filter(v => v.length)
      );

      kpiHtml.push(buildKpi(k.label || `Únicos (${col})`, String(set.size)));
    }
  });

  // si no se generó nada, al menos filas
  if (!kpiHtml.length) {
    kpiHtml.push(buildKpi("Filas", String(dataRows.length)));
  }

  kpisEl.innerHTML = kpiHtml.join("");
}

loadStats();
