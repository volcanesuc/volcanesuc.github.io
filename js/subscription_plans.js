import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { loadHeader } from "./components/header.js";
import { showLoader, hideLoader } from "./ui/loader.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

loadHeader("admin"); // o el tab que usés
document.getElementById("logoutBtn")?.addEventListener("click", logout);

const COL = "subscription_plans";

const tbody = document.getElementById("plansTbody");
const btnNew = document.getElementById("btnNewPlan");
const btnRefresh = document.getElementById("btnRefresh");

const searchInput = document.getElementById("searchInput");
const seasonFilter = document.getElementById("seasonFilter");
const statusFilter = document.getElementById("statusFilter");

const planModalEl = document.getElementById("planModal");
const planModal = new bootstrap.Modal(planModalEl);

const planIdEl = document.getElementById("planId");
const planModalTitle = document.getElementById("planModalTitle");

const planName = document.getElementById("planName");
const planSeason = document.getElementById("planSeason");
const planCurrency = document.getElementById("planCurrency");
const planTotal = document.getElementById("planTotal");
const planAllowCustomAmount = document.getElementById("planAllowCustomAmount");
const planAllowPartial = document.getElementById("planAllowPartial");
const planRequiresValidation = document.getElementById("planRequiresValidation");
const planActive = document.getElementById("planActive");
const planSortIndex = document.getElementById("planSortIndex");
const planTags = document.getElementById("planTags");
const planBenefits = document.getElementById("planBenefits");

const installmentsTbody = document.getElementById("installmentsTbody");
const btnAddInstallment = document.getElementById("btnAddInstallment");

const btnSavePlan = document.getElementById("btnSavePlan");
const btnArchivePlan = document.getElementById("btnArchivePlan");

let allPlans = []; // cache para filtrar client-side

watchAuth(async (user) => {
  if (!user) return;
  await loadPlans();
});

/* -------------------------
   Render helpers
------------------------- */

function fmtMoney(n, cur="CRC"){
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CR", { style:"currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

function badge(text, cls=""){
  return `<span class="badge-soft ${cls}">${text}</span>`;
}

function planStateLabel(p){
  if (p.archived) return badge("Archivado", "gray");
  if (!p.active) return badge("Inactivo", "gray");
  return badge("Activo", "yellow");
}

function normalizeText(s){
  return (s || "").toString().toLowerCase().trim();
}

/* -------------------------
   Load + filter
------------------------- */

async function loadPlans(){
  showLoader?.("Cargando planes…");

  // Escalable: podés paginar después. Por ahora traemos y filtramos.
  const q = query(collection(db, COL), orderBy("sortIndex", "asc"));
  const snap = await getDocs(q);

  allPlans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderPlans();
  hideLoader?.();
}

function renderPlans(){
  const qText = normalizeText(searchInput.value);
  const seasonVal = seasonFilter.value;
  const statusVal = statusFilter.value;

  let list = [...allPlans];

  // season
  if (seasonVal !== "all"){
    list = list.filter(p => (p.season || "all") === seasonVal);
  }

  // status
  if (statusVal === "active"){
    list = list.filter(p => !p.archived && p.active);
  } else if (statusVal === "inactive"){
    list = list.filter(p => !p.archived && !p.active);
  } else if (statusVal === "archived"){
    list = list.filter(p => !!p.archived);
  }

  // search (name + tags)
  if (qText){
    list = list.filter(p => {
      const name = normalizeText(p.name);
      const tags = (p.tags || []).map(normalizeText).join(" ");
      return name.includes(qText) || tags.includes(qText);
    });

    allPlans.sort((a,b) => {
    const si = (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
    if (si !== 0) return si;
    return (a.name || "").localeCompare(b.name || "", "es");
  });
    
  }

  if (!list.length){
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">No hay planes con esos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const season = p.season || "all";
    const cur = p.currency || "CRC";
    const cuotas = (p.installmentsTemplate || []).length || 0;
    const monto = p.allowCustomAmount ? "Editable" : fmtMoney(p.totalAmount, cur);

    return `
      <tr>
        <td>
          <div class="fw-bold">${p.name || "—"}</div>
          <div class="small text-muted">${(p.tags || []).join(", ")}</div>
        </td>
        <td>${season}</td>
        <td>${monto}</td>
        <td>${cuotas}</td>
        <td>${planStateLabel(p)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${p.id}">
            <i class="bi bi-pencil me-1"></i> Editar
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

/* -------------------------
   Modal: open/close
------------------------- */

function clearModal(){
  planIdEl.value = "";
  planModalTitle.textContent = "Nuevo plan";

  planName.value = "";
  planSeason.value = "2026";
  planCurrency.value = "CRC";
  planTotal.value = "";
  planAllowCustomAmount.checked = false;
  planAllowPartial.checked = true;
  planRequiresValidation.checked = true;
  planActive.checked = true;
  planSortIndex.value = "10";
  planTags.value = "";
  planBenefits.value = "";

  installmentsTbody.innerHTML = "";
  btnArchivePlan.style.display = "none";
}

function setInstallments(rows){
  const list = Array.isArray(rows) ? rows : [];
  installmentsTbody.innerHTML = list
    .sort((a,b)=> (a.n||0)-(b.n||0))
    .map((r, idx) => installmentRow(idx+1, r.dueMonthDay || "", r.amount ?? ""))
    .join("");

  renumberInstallments();
}

function installmentRow(n, dueMonthDay, amount){
  return `
    <tr data-row="installment">
      <td class="fw-bold">
        <span class="installment-n">${n}</span>
      </td>
      <td>
        <input class="form-control form-control-sm due" placeholder="MM-DD" value="${dueMonthDay}">
      </td>
      <td>
        <input class="form-control form-control-sm amt" type="number" placeholder="20000" value="${amount}">
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" data-action="removeInstallment">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `;
}

function renumberInstallments(){
  [...installmentsTbody.querySelectorAll('tr[data-row="installment"]')].forEach((tr, i)=>{
    tr.querySelector(".installment-n").textContent = String(i+1);
  });
}

function readInstallmentsFromUI(){
  const rows = [...installmentsTbody.querySelectorAll('tr[data-row="installment"]')];
  return rows.map((tr, idx) => {
    const dueMonthDay = tr.querySelector(".due").value.trim();
    const amount = Number(tr.querySelector(".amt").value);
    return {
      n: idx + 1,
      dueMonthDay,
      amount: Number.isNaN(amount) ? 0 : amount
    };
  }).filter(r => r.dueMonthDay || r.amount);
}

/* -------------------------
   Validation
------------------------- */

function validateMonthDay(mmdd){
  // mm-dd
  return /^\d{2}-\d{2}$/.test(mmdd);
}

function validatePlanPayload(p){
  if (!p.name) return "Falta el nombre del plan.";
  if (!p.season) return "Falta la temporada (ej: 2026 o all).";

  if (!p.allowCustomAmount && (p.totalAmount === null || p.totalAmount === undefined || p.totalAmount === "")){
    return "Falta el monto total (o marcá Monto editable).";
  }

  if (p.allowPartial){
    const inst = p.installmentsTemplate || [];
    if (!inst.length) return "Marcaste “Permite cuotas” pero no definiste cuotas.";
    const bad = inst.find(x => x.dueMonthDay && !validateMonthDay(x.dueMonthDay));
    if (bad) return "Formato de fecha inválido en cuotas. Usá MM-DD (ej: 02-15).";
  }

  return null;
}

/* -------------------------
   Events
------------------------- */

btnRefresh.addEventListener("click", loadPlans);
btnNew.addEventListener("click", () => {
  clearModal();
  setInstallments([
    { n:1, dueMonthDay:"02-15", amount:"" }
  ]);
  planModal.show();
});

searchInput.addEventListener("input", renderPlans);
seasonFilter.addEventListener("change", renderPlans);
statusFilter.addEventListener("change", renderPlans);

tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "edit"){
    await openEdit(id);
  }
});

btnAddInstallment.addEventListener("click", () => {
  installmentsTbody.insertAdjacentHTML("beforeend", installmentRow(1, "", ""));
  renumberInstallments();
});

installmentsTbody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "removeInstallment"){
    btn.closest("tr")?.remove();
    renumberInstallments();
  }
});

btnSavePlan.addEventListener("click", savePlan);
btnArchivePlan.addEventListener("click", archivePlan);

/* -------------------------
   CRUD
------------------------- */

async function openEdit(id){
  showLoader?.("Cargando plan…");

  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    hideLoader?.();
    alert("No se encontró el plan.");
    return;
  }

  const p = { id: snap.id, ...snap.data() };

  clearModal();
  planIdEl.value = p.id;
  planModalTitle.textContent = "Editar plan";

  planName.value = p.name || "";
  planSeason.value = p.season || "all";
  planCurrency.value = p.currency || "CRC";
  planTotal.value = (p.totalAmount ?? "");
  planAllowCustomAmount.checked = !!p.allowCustomAmount;
  planAllowPartial.checked = !!p.allowPartial;
  planRequiresValidation.checked = !!p.requiresValidation;
  planActive.checked = !!p.active;
  planSortIndex.value = String(p.sortIndex ?? 10);
  planTags.value = (p.tags || []).join(", ");
  planBenefits.value = (p.benefits || []).join("\n");

  setInstallments(p.installmentsTemplate || []);
  btnArchivePlan.style.display = "inline-block";

  hideLoader?.();
  planModal.show();
}

async function savePlan(){
  const id = planIdEl.value || null;

  const payload = {
    name: planName.value.trim(),
    season: planSeason.value.trim() || "all",
    currency: planCurrency.value,
    totalAmount: planTotal.value === "" ? null : Number(planTotal.value),
    allowCustomAmount: !!planAllowCustomAmount.checked,
    allowPartial: !!planAllowPartial.checked,
    requiresValidation: !!planRequiresValidation.checked,
    active: !!planActive.checked,
    archived: false,
    sortIndex: Number(planSortIndex.value || 10),

    tags: planTags.value.split(",").map(s => s.trim()).filter(Boolean),
    benefits: planBenefits.value.split("\n").map(s => s.trim()).filter(Boolean),

    installmentsTemplate: planAllowPartial.checked ? readInstallmentsFromUI() : []
  };

  const err = validatePlanPayload(payload);
  if (err) return alert(err);

  if (!payload.allowCustomAmount && (payload.totalAmount === null || payload.totalAmount === undefined)){
    payload.totalAmount = (payload.installmentsTemplate || []).reduce((sum, x)=> sum + (Number(x.amount)||0), 0);
  }

  showLoader?.("Guardando…");

  try {
    if (!id){
      await addDoc(collection(db, COL), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(doc(db, COL, id), {
        ...payload,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // Si el refresh falla, igual cerramos modal y quitamos loader
    try {
      await loadPlans();
    } catch (e) {
      console.warn("Guardó, pero falló refresh:", e);
    }

    planModal.hide();
    alert("✅ Plan guardado");
  } catch (e) {
    console.error(e);
    alert("❌ Error guardando el plan: " + (e?.message || e));
  } finally {
    hideLoader?.();
  }
}


async function archivePlan(){
  const id = planIdEl.value;
  if (!id) return;

  if (!confirm("¿Archivar este plan? No se borrará, solo se ocultará por defecto.")) return;

  showLoader?.("Archivando…");
  await updateDoc(doc(db, COL, id), {
    archived: true,
    active: false,
    updatedAt: serverTimestamp()
  });

  await loadPlans();
  hideLoader?.();
  planModal.hide();
}
