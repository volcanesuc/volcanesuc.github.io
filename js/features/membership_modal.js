import { db } from "../firebase.js";
import { watchAuth } from "../auth.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Collections
========================= */
const COL_ASSOC = "associates";
const COL_PLANS = "subscription_plans";
const COL_MEMBERSHIPS = "memberships";
const COL_INSTALLMENTS = "membership_installments";

/* =========================
   DOM
========================= */
const seasonEl = document.getElementById("season");

const associateSearch = document.getElementById("associateSearch");
const associateMenu = document.getElementById("associateMenu");
const associateSelected = document.getElementById("associateSelected");
const btnNewAssociate = document.getElementById("btnNewAssociate");

const planSelect = document.getElementById("planSelect");
const planHint = document.getElementById("planHint");

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

const btnClose = document.getElementById("btnClose");
const btnCancel = document.getElementById("btnCancel");

/* =========================
   State
========================= */
let associates = [];
let plans = [];
let selectedAssociate = null;
let selectedPlan = null;

/* =========================
   postMessage helpers
========================= */
function post(type, detail) {
  window.parent.postMessage({ type, detail }, window.location.origin);
}
function close() {
  post("modal:close");
}

/* =========================
   Helpers
========================= */
function norm(s){ return (s || "").toString().toLowerCase().trim(); }

function fmtMoney(n, cur="CRC"){
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", { style:"currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function randomCode(len = 6){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function mmddToIsoDate(season, mmdd){
  if (!season || !/^\d{4}$/.test(season)) return null;
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd)) return null;
  return `${season}-${mmdd}`;
}

function planDisplay(p){
  const cur = p.currency || "CRC";
  const base = p.allowCustomAmount ? "Monto editable" : fmtMoney(p.totalAmount, cur);
  const cuotas = (p.installmentsTemplate || []).length;
  const cuotasTxt = p.allowPartial ? ` • ${cuotas} cuota(s)` : "";
  return `${p.name || "Plan"} — ${base}${cuotasTxt}`;
}

function setResultLink(mid, code){
  // Construye URL relativa al sitio actual (GitHub pages / hosting)
  const baseDir = window.location.href.replace(/\/[^/]+$/, "/");
  const url = `${baseDir}membership_pay.html?mid=${encodeURIComponent(mid)}&code=${encodeURIComponent(code)}`;

  payLinkText.textContent = url;
  btnOpenLink.href = url;

  // Detalle admin en tab nuevo
  btnGoDetail.href = `${baseDir}membership_detail.html?mid=${encodeURIComponent(mid)}`;

  resultBox.style.display = "block";
}

function clearResultLink(){
  resultBox.style.display = "none";
  payLinkText.textContent = "";
  btnOpenLink.removeAttribute("href");
  btnGoDetail.href = "#";
}

/* =========================
   Load data
========================= */
watchAuth(async (user) => {
  if (!user) return;
  await boot();
});

async function boot(){
  showLoader?.("Cargando…");
  try{
    await Promise.all([loadAssociates(), loadPlans()]);
    wireUI();
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

  planSelect.innerHTML = `<option value="">Seleccioná un plan…</option>` + plans.map(p => {
    return `<option value="${p.id}">${planDisplay(p)}</option>`;
  }).join("");
}

/* =========================
   Associate picker UI
========================= */
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

function closeMenu(){
  associateMenu.style.display = "none";
}

function selectAssociateById(id){
  const a = associates.find(x => x.id === id);
  if (!a) return;
  selectedAssociate = a;
  associateSearch.value = a.fullName || "";
  associateSelected.textContent = `Seleccionado: ${a.fullName || "—"}`;
  closeMenu();
  renderPreview();
}

/* =========================
   UI wiring
========================= */
function wireUI(){
  btnClose?.addEventListener("click", close);
  btnCancel?.addEventListener("click", close);

  btnNewAssociate?.addEventListener("click", () => {
    // le pedimos al host abrir el modal de asociado
    post("associate:open", { mode: "create" });
  });

  associateSearch.addEventListener("input", () => {
    const q = norm(associateSearch.value);
    if (!q){
      closeMenu();
      return;
    }
    const matches = associates.filter(a => {
      const t = `${norm(a.fullName)} ${norm(a.email)} ${norm(a.phone)}`;
      return t.includes(q);
    }).slice(0, 20);
    openMenu(matches);
  });

  associateSearch.addEventListener("focus", () => {
    const q = norm(associateSearch.value);
    if (q){
      const matches = associates.filter(a => {
        const t = `${norm(a.fullName)} ${norm(a.email)} ${norm(a.phone)}`;
        return t.includes(q);
      }).slice(0, 20);
      openMenu(matches);
    }
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
    renderPreview();
  });

  seasonEl.addEventListener("input", renderPreview);

  btnClear.addEventListener("click", () => {
    selectedAssociate = null;
    selectedPlan = null;
    associateSearch.value = "";
    associateSelected.textContent = "Ninguno seleccionado";
    planSelect.value = "";
    seasonEl.value = seasonEl.value || "2026";
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

  // escuchar cuando el host crea un asociado nuevo
  window.addEventListener("message", async (ev) => {
    if (ev.origin !== window.location.origin) return;
    const msg = ev.data || {};
    if (msg.type === "associate:saved") {
      // recargar lista y autoseleccionar si vino id
      await loadAssociates();
      if (msg.detail?.id) selectAssociateById(msg.detail.id);
    }
  });
}

/* =========================
   Preview
========================= */
function renderPreview(){
  if (selectedAssociate){
    previewAssociate.textContent = selectedAssociate.fullName || "—";
    const parts = [
      selectedAssociate.email ? selectedAssociate.email : null,
      selectedAssociate.phone ? selectedAssociate.phone : null
    ].filter(Boolean);
    previewAssociateContact.textContent = parts.length ? parts.join(" • ") : "—";
  } else {
    previewAssociate.textContent = "—";
    previewAssociateContact.textContent = "—";
  }

  if (selectedPlan){
    previewPlan.textContent = selectedPlan.name || "—";
    const cur = selectedPlan.currency || "CRC";
    const total = selectedPlan.allowCustomAmount ? "Monto editable" : fmtMoney(selectedPlan.totalAmount, cur);
    const flags = [
      selectedPlan.allowPartial ? "Permite cuotas" : "Pago único",
      selectedPlan.requiresValidation ? "Requiere validación" : "Sin validación"
    ];
    previewPlanMeta.textContent = `${total} • ${flags.join(" • ")}`;
    planHint.textContent = durationHint(selectedPlan);
  } else {
    previewPlan.textContent = "—";
    previewPlanMeta.textContent = "—";
    planHint.textContent = "";
  }

  const season = (seasonEl.value || "").trim();
  if (!selectedPlan){
    previewTotal.textContent = "—";
    previewInstallments.innerHTML = `<tr><td colspan="3" class="text-muted">—</td></tr>`;
    return;
  }

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
    .map(x => {
      const dueIso = mmddToIsoDate(season, x.dueMonthDay);
      const dueTxt = dueIso || (x.dueMonthDay || "—");
      return `
        <tr>
          <td class="fw-bold">${x.n ?? "—"}</td>
          <td>${dueTxt}</td>
          <td>${fmtMoney(x.amount, cur)}</td>
        </tr>
      `;
    }).join("");

  previewInstallments.innerHTML = rows || `<tr><td colspan="3" class="text-muted">—</td></tr>`;
}

function durationHint(p){
  const dm = Number(p.durationMonths || 0);
  const sp = p.startPolicy || "JAN_ONLY";
  if (!dm) return "";
  const dur = dm === 12 ? "12 meses" : dm === 6 ? "6 meses" : dm === 1 ? "1 mes" : `${dm} meses`;
  const start =
    dm === 1 ? "cualquier mes"
    : dm === 6 ? (sp === "JAN_OR_JUL" ? "enero o julio" : "enero")
    : "enero";
  return `Cubre ${dur}. Inicio permitido: ${start}.`;
}

/* =========================
   Create membership
========================= */
async function createMembership(){
  const season = (seasonEl.value || "").trim();
  if (!/^\d{4}$/.test(season) && season !== "all"){
    return alert("Temporada inválida. Usá 2026 (YYYY) o 'all'.");
  }
  if (!selectedAssociate) return alert("Seleccioná un asociado.");
  if (!selectedPlan) return alert("Seleccioná un plan.");

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
    durationMonths: Number(selectedPlan.durationMonths || 0),
    startPolicy: selectedPlan.startPolicy || "JAN_ONLY",
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

      status: "pending",
      totalAmount: planSnap.allowCustomAmount ? null : (totalAmount ?? null),
      currency: planSnap.currency,

      payCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const mid = membershipDoc.id;

    if (planSnap.allowPartial && installmentsTemplate.length){
      const sorted = installmentsTemplate.slice().sort((a,b)=> (a.n||0)-(b.n||0));
      for (const it of sorted){
        const dueIso = season === "all" ? null : mmddToIsoDate(season, it.dueMonthDay);
        await addDoc(collection(db, COL_INSTALLMENTS), {
          membershipId: mid,
          season,
          planId: planSnap.id,

          n: Number(it.n || 0),
          dueMonthDay: it.dueMonthDay || null,
          dueDate: dueIso,
          amount: Number(it.amount || 0),

          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }

    alert("✅ Membresía creada");
    setResultLink(mid, payCode);

    // avisar al host para refrescar lista
    post("membership:created", { id: mid, associateId: assocSnap.id, season });

  } catch (e){
    console.error(e);
    alert("❌ Error creando membresía: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
}
