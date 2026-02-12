import { db } from "../firebase.js";
import { watchAuth } from "../auth.js";
import { showLoader, hideLoader } from "../ui/loader.js";

import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL = "associates";

const params = new URLSearchParams(window.location.search);
const aid = params.get("aid");

// ui
const modalTitle = document.getElementById("modalTitle");
const associateId = document.getElementById("associateId");

const fullName = document.getElementById("fullName");
const type = document.getElementById("type");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const idNumber = document.getElementById("idNumber");
const active = document.getElementById("active");
const notes = document.getElementById("notes");

const btnClose = document.getElementById("btnClose");
const btnCancel = document.getElementById("btnCancel");
const btnSave = document.getElementById("btnSave");

function clean(s){ return (s || "").toString().trim(); }
function validateEmail(v){
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function post(type, detail){
  // mismo origen
  window.parent.postMessage({ type, detail }, window.location.origin);
}

function close(){
  post("modal:close");
}

btnClose?.addEventListener("click", close);
btnCancel?.addEventListener("click", close);

function buildPayload(){
  return {
    fullName: clean(fullName.value),
    type: type.value || "other",
    email: clean(email.value) || null,
    phone: clean(phone.value) || null,
    idNumber: clean(idNumber.value) || null,
    active: !!active.checked,
    notes: clean(notes.value) || null,
    updatedAt: serverTimestamp()
  };
}

watchAuth(async (user) => {
  if (!user) return;
  if (aid) await loadAssociate(aid);
});

async function loadAssociate(id){
  showLoader?.("Cargando asociado…");
  try{
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()){
      alert("No se encontró el asociado.");
      return close();
    }

    const a = snap.data();
    associateId.value = snap.id;

    modalTitle.textContent = "Editar asociado";

    fullName.value = a.fullName || "";
    type.value = a.type || "other";
    email.value = a.email || "";
    phone.value = a.phone || "";
    idNumber.value = a.idNumber || "";
    active.checked = a.active !== false;
    notes.value = a.notes || "";
  } finally {
    hideLoader?.();
  }
}

btnSave?.addEventListener("click", async () => {
  const name = clean(fullName.value);
  if (!name) return alert("Falta el nombre.");

  const mail = clean(email.value);
  if (mail && !validateEmail(mail)) return alert("Email inválido.");

  showLoader?.("Guardando…");
  btnSave.disabled = true;

  try{
    const payload = buildPayload();

    if (!aid){
      const ref = await addDoc(collection(db, COL), {
        ...payload,
        createdAt: serverTimestamp()
      });

      post("associate:saved", { id: ref.id, mode: "create" });
      return;
    }

    await updateDoc(doc(db, COL, aid), payload);
    post("associate:saved", { id: aid, mode: "update" });

  } catch(e){
    console.error(e);
    alert("❌ Error guardando: " + (e?.message || e));
  } finally{
    btnSave.disabled = false;
    hideLoader?.();
  }
});
