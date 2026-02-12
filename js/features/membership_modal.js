import { db } from "../firebase.js";
import { watchAuth } from "../auth.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  collection,
  getDocs,
  addDoc,
  addDoc as addInstallmentDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL_ASSOC = "associates";
const COL_PLANS = "subscription_plans";
const COL_MEMBERSHIPS = "memberships";
const COL_INSTALLMENTS = "membership_installments";

// UI
const seasonEl = document.getElementById("season");

const associateSearch = document.getElementById("associateSearch");
const associateMenu = document.getElementById("associateMenu");
const associateSelected = document.getElementById("associateSelected");

const planSelect = document.getElementById("planSelect");
const planHint = document.getElementById("planHint");

const startPolicyEl = document.getElementById("startPolicy");
const startMonthEl = document.getElementById("startMonth");
const startMonthHintEl = document.getElementById("startMonthHint");

const btnCreate = document.getElementById("btnCreate");
const btnClear = document.getElementById("btnClear");

const previewAssociate = document.getElementById("previewAssociate");
const previewAssociateContact = document.getElementById("previewAssociateContact");
const previewPlan = document.getElementById("previewPlan");
const previewPlanMeta = document.getElementById("previewPlanMeta");
const previewTotal = document.getElementById("previewTotal");
const previewInstallments = document.getElementById("previewInstallments");

const resultBox = document.getElementById("resultBox");
const payLinkText = document.getElementById("payLinkText");
const btnCopyLink = document.getElementById("btnCopyLink");
const btnOpenLink = document.getElementById("btnOpenLink");
const btnGoDetail = document.getElementById("btnGoDetail");

// state
let associates = [];
let plans = [];
let selectedAssociate = null;
let selectedPlan = null;

function norm(s){ return (s || "").toString().toLowerCase().trim(); }

function fmtMoney(n, cur="CRC"){
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", { style:"currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function randomCode(len = 7){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function monthLabel(m){
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return names[m-1] || `Mes ${m}`;
}

function toIso(season, month, day = 1){
  if (!/^\d{4}$/.test(String(season))) return null;
  const mm = String(month).padStart(2,"0");
  const dd = String(day).padStart(2,"0");
  return `${season}-${mm}-${dd}`;
}

/**
 * coverageEnd = (startMonth + durationMonths) - 1 month (inclusive range)
 * Ej: start=1, dur=12 => end=12
 *     start=7, dur=6  => end=12
 *     start=2, dur=1  => end=2
 */
function calcCoverage(season, startMonth, durationMonths){
  const s = Number(startMonth);
  const d = Number(durationMonths);
  if (!/^\d{4}$/.test(String(season))) return null;
  if (!Number.isFinite(s) || s < 1 || s > 12) return null;
  if (!Number.isFinite(d) || d < 1 || d > 24) return null; // safety

  // months are 1..12 within season; if it overflows, cortamos al 12
  const endMonth = Math.min(12, s + d - 1);

  return {
    startMonth: s,
    endMonth,
    coverageStart: toIso(season, s, 1),
    coverageEnd: toIso(season, endMonth, 1)
  };
}

function allowedStartMonths(policy){
  const p = (policy || "any").toLowerCase();
  if (p === "jan") return [1];
  if (p === "jan_jul") return [1, 7];
  // any
  return [1,2,3,4,5,6,7,8,9,10,11,12];
}

function renderStartMonths(){
  const policy = startPolicyEl?.value || "any";
  const allowed = allowedStartMonths(policy);

  const current = Number(startMonthEl?.value || allowed[0]);
  const keep = allowed.includes(current) ? current : allowed[0];

  startMonthEl.innerHTML = allowed
    .map(m => `<option value="${m}">${monthLabel(m)}</option>`)
    .join("");

  startMonthEl.value = String(keep);

  if (startMonthHintEl){
    if (policy === "jan") startMonthHintEl.textContent = "Este plan/membresía contará desde enero.";
    else if (policy === "jan_jul") startMonthHintEl.textContent = "Elegí Enero (1er semestre) o Julio (2do semestre).";
    else startMonthHintEl.textContent = "Podés iniciar en cualquier mes.";
  }
}

function planDisplay(p){
  const cur = p.currency || "CRC";
  const base = p.allowCustomAmount ? "Monto editable" : fmtMoney(p.totalAmount, cur);
  const cuotas = (p.installmentsTemplate || []).length;
  const cuotasTxt = p.allowPartial ? ` • ${cuotas} cuota(s)` : "";
  const dur = p.durationMonths ? ` • ${p.durationMonths} mes(es)` : "";
  return `${p.name || "Plan"} — ${base}${cuotasTxt}${dur}`;
}

function setResultLink(mid, code){
  const url = `${window.location.origin}${window.location.pathname.replace(/\/[^/]+$/, "/")}membership_pay.html?mid=${encodeURIComponent(mid)}&code=${encodeURIComponent(code)}`;
  payLinkText.textContent = url;
  btnOpenLink.href = url;
  btnGoDetail.href = `membership_detail.html?mid=${encodeURIComponent(mid)}`;
  resultBox.style.display = "block";
}

function clearResultLink(){
  resultBox.style.display = "none";
  payLinkText.textContent = "";
  btnOpenLink.removeAttribute("href");
}

// -------- Associate picker (igual que tu editor) --------
function openMenu(items){
  associateMenu.innerHTML = items.map(a => {
    const email = a.email ? `<div class="text-muted small">${a.email}</div>` : "";
    const phone = a.phone ? `<div class="text-muted small">${a.phone}</div>` : "";
    return `
      <div class="picklist-item" data-id="${a.id}">
        <div class="fw-bold">${a.fullName || "—"}</div>
        ${email || phone ? `<div>${email}${phone}</div>` : `<div class="text-muted small">—</div>`}
      </div>
    `;
  }).join("") || `<div class="p-3 text-muted">No hay resultados.</div>`;

  associateMenu.style.display = "block";
}

function closeMenu(){ associateMenu.style.display = "none"; }

function selectAssociateById(id){
  const a = associates.find(x => x.id === id);
  if (!a) return;
  selectedAssociate = a;
  associateSearch.value = a.fullName || "";
  associateSelected.textContent = `Seleccionado: ${a.fullName || "—"}`;
  closeMenu();
  renderPreview();
}

// -------- Load data --------
watchAuth(async (user) => {
  if (!user) return;
  await boot();
});

async function boot(){
  showLoader?.("Cargando…");
  try{
    await Promise.all([loadAssociates(), loadPlans()]);
    wireUI();

    // defaults para start policy
    if (startPolicyEl && !startPolicyEl.value) startPolicyEl.value = "any";
    renderStartMonths();

    renderPreview();
  } finally {
    hideLoader?.();
  }
}

async function loadAssociates(){
  const snap = await getDocs(collection(db, COL_ASSOC));
  associates = snap.docs
    .map(d => ({ id:d.id, ...d.data() }))
    .filter(a => a.active !== false)
    .sort((a,b) => (a.fullName || "").localeCompare(b.fullName || "", "es"));
}

async function loadPlans(){
  const snap = await getDocs(collection(db, COL_PLANS));
  plans = snap.docs
    .map(d => ({ id:d.id, ...d.data() }))
    .filter(p => !p.archived && p.active)
    .sort((a,b) => (a.name || "").localeCompare(b.name || "", "es"));

  planSelect.innerHTML =
    `<option value="">Seleccioná un plan…</option>` +
    plans.map(p => `<option value="${p.id}">${planDisplay(p)}</option>`).join("");
}

// -------- UI wiring --------
function wireUI(){
  associateSearch.addEventListener("input", () => {
    const q = norm(associateSearch.value);
    if (!q){ closeMenu(); return; }
    const matches = associates.filter(a => {
      const t = `${norm(a.fullName)} ${norm(a.email)} ${norm(a.phone)}`;
      return t.includes(q);
    }).slice(0, 20);
    openMenu(matches);
  });

  associateSearch.addEventListener("focus", () => {
    const q = norm(associateSearch.value);
    if (!q) return;
    const matches = associates.filter(a => {
      const t = `${norm(a.fullName)} ${norm(a.email)} ${norm(a.phone)}`;
      return t.includes(q);
    }).slice(0, 20);
    openMenu(matches);
  });

  document.addEventListener("click", (e) => {
    const inside = e.target.closest(".picklist");
    if (!inside) closeMenu();
  });

  associateMenu.addEventListener("click", (e) => {
    const item = e.target.closest(".picklist-item");
    if (!item) return;
    selectAssociateById(item.dataset.id);
  });

  planSelect.addEventListener("change", () => {
    const pid = planSelect.value || "";
    selectedPlan = plans.find(p => p.id === pid) || null;

    // opcional: si querés un default por plan:
    // startPolicyEl.value = selectedPlan?.startPolicyDefault || startPolicyEl.value || "any";
    renderStartMonths();

    renderPreview();
  });

  seasonEl.addEventListener("input", renderPreview);

  startPolicyEl?.addEventListener("change", () => {
    renderStartMonths();
    renderPreview();
  });

  startMonthEl?.addEventListener("change", renderPreview);

  btnClear.addEventListener("click", () => {
    selectedAssociate = null;
    selectedPlan = null;
    associateSearch.value = "";
    associateSelected.textContent = "Ninguno seleccionado";
    planSelect.value = "";
    seasonEl.value = seasonEl.value || "2026";

    if (startPolicyEl) startPolicyEl.value = "any";
    renderStartMonths();

    clearResultLink();
    renderPreview();
  });

  btnCopyLink.addEventListener("click", async () => {
    const txt = payLinkText.textContent || "";
    if (!txt) return;
    try{
      await navigator.clipboard.writeText(txt);
      alert("✅ Link copiado");
    }catch{
      prompt("Copiá el link:", txt);
    }
  });

  btnCreate.addEventListener("click", createMembership);
}

// -------- Preview --------
function renderPreview(){
  if (selectedAssociate){
    previewAssociate.textContent = selectedAssociate.fullName || "—";
    const parts = [selectedAssociate.email || null, selectedAssociate.phone || null].filter(Boolean);
    previewAssociateContact.textContent = parts.length ? parts.join(" • ") : "—";
  } else {
    previewAssociate.textContent = "—";
    previewAssociateContact.textContent = "—";
  }

  if (selectedPlan){
    previewPlan.textContent = selectedPlan.name || "—";
    const cur = selectedPlan.currency || "CRC";
    const total = selectedPlan.allowCustomAmount ? "Monto editable" : fmtMoney(selectedPlan.totalAmount, cur);
    const dur = selectedPlan.durationMonths ? `${selectedPlan.durationMonths} mes(es)` : "duración sin definir";
    const flags = [
      selectedPlan.allowPartial ? "Permite cuotas" : "Pago único",
      selectedPlan.requiresValidation ? "Requiere validación" : "Sin validación",
      dur
    ];
    previewPlanMeta.textContent = `${total} • ${flags.join(" • ")}`;
  } else {
    previewPlan.textContent = "—";
    previewPlanMeta.textContent = "—";
  }

  if (!selectedPlan){
    previewTotal.textContent = "—";
    previewInstallments.innerHTML = `<tr><td colspan="3" class="text-muted">—</td></tr>`;
    return;
  }

  const season = (seasonEl.value || "").trim();
  const cur = selectedPlan.currency || "CRC";
  const installments = Array.isArray(selectedPlan.installmentsTemplate) ? selectedPlan.installmentsTemplate : [];

  let totalAmount = selectedPlan.totalAmount ?? null;
  if (!selectedPlan.allowCustomAmount && (totalAmount === null || totalAmount === undefined)){
    totalAmount = installments.reduce((sum, x) => sum + (Number(x.amount)||0), 0);
  }
  previewTotal.textContent = selectedPlan.allowCustomAmount ? "Editable" : fmtMoney(totalAmount, cur);

  if (!selectedPlan.allowPartial || installments.length === 0){
    previewInstallments.innerHTML = `<tr><td colspan="3" class="text-muted">Sin cuotas (pago único)</td></tr>`;
    return;
  }

  const rows = installments
    .slice()
    .sort((a,b) => (a.n||0)-(b.n||0))
    .map(x => `
      <tr>
        <td class="fw-bold">${x.n ?? "—"}</td>
        <td>${x.dueMonthDay || "—"}</td>
        <td>${fmtMoney(x.amount, cur)}</td>
      </tr>
    `).join("");

  previewInstallments.innerHTML = rows || `<tr><td colspan="3" class="text-muted">—</td></tr>`;

  // hint de cobertura (opcional)
  if (planHint){
    const pol = startPolicyEl?.value || "any";
    const sm = Number(startMonthEl?.value || 1);
    const dm = Number(selectedPlan.durationMonths || 0);
    const cov = calcCoverage(season, sm, dm);
    planHint.textContent = cov
      ? `Cobertura: ${monthLabel(cov.startMonth)} → ${monthLabel(cov.endMonth)} (${season}) • Policy: ${pol}`
      : `Cobertura: —`;
  }
}

// -------- Create membership --------
async function createMembership(){
  const season = (seasonEl.value || "").trim();
  if (!/^\d{4}$/.test(season) && season !== "all"){
    return alert("Temporada inválida. Usá 2026 (YYYY) o 'all'.");
  }
  if (!selectedAssociate) return alert("Seleccioná un asociado.");
  if (!selectedPlan) return alert("Seleccioná un plan.");

  const startPolicy = (startPolicyEl?.value || "any").toLowerCase();
  const startMonth = Number(startMonthEl?.value || 1);

  // validar startMonth según policy
  const allowed = allowedStartMonths(startPolicy);
  if (!allowed.includes(startMonth)){
    return alert("Mes de inicio inválido para la política seleccionada.");
  }

  // validar durationMonths
  const durationMonths = Number(selectedPlan.durationMonths || 0);
  if (!Number.isFinite(durationMonths) || durationMonths <= 0){
    return alert("Este plan no tiene duración configurada (durationMonths). Editá el plan y definí 1, 6, 12, etc.");
  }

  const cov = season === "all" ? null : calcCoverage(season, startMonth, durationMonths);
  if (season !== "all" && !cov){
    return alert("No se pudo calcular cobertura. Revisá temporada/mes/duración.");
  }

  const planSnap = {
    id: selectedPlan.id,
    name: selectedPlan.name || "",
    currency: selectedPlan.currency || "CRC",
    totalAmount: selectedPlan.totalAmount ?? null,
    allowCustomAmount: !!selectedPlan.allowCustomAmount,
    allowPartial: !!selectedPlan.allowPartial,
    requiresValidation: !!selectedPlan.requiresValidation,
    benefits: Array.isArray(selectedPlan.benefits) ? selectedPlan.benefits : [],
    tags: Array.isArray(selectedPlan.tags) ? selectedPlan.tags : [],
    durationMonths
  };

  const assocSnap = {
    id: selectedAssociate.id,
    fullName: selectedAssociate.fullName || "",
    email: selectedAssociate.email || null,
    phone: selectedAssociate.phone || null
  };

  const installmentsTemplate = Array.isArray(selectedPlan.installmentsTemplate) ? selectedPlan.installmentsTemplate : [];
  let totalAmount = selectedPlan.totalAmount ?? null;

  if (!planSnap.allowCustomAmount && (totalAmount === null || totalAmount === undefined)){
    totalAmount = installmentsTemplate.reduce((sum, x) => sum + (Number(x.amount)||0), 0);
  }

  const payCode = randomCode(7);

  showLoader?.("Creando membresía…");

  try{
    const membershipDoc = await addDoc(collection(db, COL_MEMBERSHIPS), {
      associateId: assocSnap.id,
      associateSnapshot: assocSnap,

      season,
      planId: planSnap.id,
      planSnapshot: planSnap,

      // 👇 NUEVO
      startPolicy,
      startMonth,
      durationMonths,
      coverageStart: season === "all" ? null : cov.coverageStart,
      coverageEnd: season === "all" ? null : cov.coverageEnd,

      status: "pending",
      totalAmount: planSnap.allowCustomAmount ? null : (totalAmount ?? null),
      currency: planSnap.currency,

      payCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const mid = membershipDoc.id;

    // cuotas (igual que antes)
    if (planSnap.allowPartial && installmentsTemplate.length){
      const sorted = installmentsTemplate.slice().sort((a,b)=> (a.n||0)-(b.n||0));
      for (const it of sorted){
        await addInstallmentDoc(collection(db, COL_INSTALLMENTS), {
          membershipId: mid,
          season,
          planId: planSnap.id,
          n: Number(it.n || 0),
          dueMonthDay: it.dueMonthDay || null,
          amount: Number(it.amount || 0),
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    alert("✅ Membresía creada");
    setResultLink(mid, payCode);

    // si estás usando modal_host, avisamos al parent para refrescar lista
    try {
      window.parent.postMessage({ type: "membership:created", detail: { id: mid } }, window.location.origin);
    } catch {}

  } catch (e){
    console.error(e);
    alert("❌ Error creando membresía: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
}
