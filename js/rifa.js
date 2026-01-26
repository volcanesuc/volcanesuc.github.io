import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABSy5kImaF9VyNisu2vkihm2y4mfYGodw",
  authDomain: "rifavolcanes.firebaseapp.com",
  projectId: "rifavolcanes",
};

const ADMIN_PASSWORD = "admin123";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const grid = document.getElementById("grid");
const status = document.getElementById("status");
const loginBtn = document.getElementById("loginBtn");
const adminPass = document.getElementById("adminPass");

const contadorVendidos = document.getElementById("contadorVendidos");
const contadorDisponibles = document.getElementById("contadorDisponibles");
const contadorPendientes = document.getElementById("contadorPendientes");

let isAdmin = false;
const estadoNumeros = {};

loginBtn.onclick = () => {
  if (adminPass.value === ADMIN_PASSWORD) {
    isAdmin = true;
    status.innerText = "Modo admin (puedes marcar vendidos)";
    status.classList.replace("text-secondary", "text-success");
    document.querySelectorAll(".number").forEach(b =>
      b.classList.remove("disabled")
    );
  } else {
    alert("Clave incorrecta");
  }
};

for (let i = 0; i < 100; i++) {
  const btn = document.createElement("button");
  btn.className = "number btn btn-outline-secondary w-100 disabled";
  btn.innerText = i;

  btn.onclick = async () => {
    if (!isAdmin) return;

    const nombre = prompt(`Asignar nombre al número ${i}:`);
    if (!nombre) return;

    await setDoc(
      doc(db, "rifa", i.toString()),
      { vendido: true, nombre },
      { merge: true }
    );
  };

  const col = document.createElement("div");
  col.appendChild(btn);
  grid.appendChild(col);

  onSnapshot(doc(db, "rifa", i.toString()), (snap) => {
    btn.classList.remove("vendido", "pendiente", "btn-danger", "btn-warning");
    btn.classList.add("btn-outline-secondary");

    let vendido = false;
    let nombre = "";

    if (snap.exists() && snap.data().vendido) {
      vendido = true;
      nombre = snap.data().nombre || "";

      const pendiente = nombre.toLowerCase().includes("(p)");

      btn.classList.remove("btn-outline-secondary");
      btn.classList.add(pendiente ? "btn-warning" : "btn-danger");

      if (snap.exists() && snap.data().vendido) {
        vendido = true;
        nombre = snap.data().nombre || "";

        const pendiente = nombre.toLowerCase().includes("(p)");

        btn.classList.remove("btn-outline-secondary");
        btn.classList.add(pendiente ? "btn-warning" : "btn-danger");

        if (isAdmin) {
            btn.innerText = nombre
            ? `${i}\n${nombre}`
            : i;
            btn.title = nombre ? `Asignado a: ${nombre}` : "";
        } else {
            btn.innerText = i;
            btn.title = "Número vendido";
        }

        } else {
        btn.innerText = i;
        btn.title = "";
        }

    } else {
      btn.innerText = i;
    }

    estadoNumeros[i] = { vendido, nombre };

    const vendidos = Object.values(estadoNumeros).filter(n => n.vendido);
    const pendientes = vendidos.filter(n =>
      n.nombre.toLowerCase().includes("(p)")
    );

    contadorVendidos.innerText = vendidos.length;
    contadorDisponibles.innerText = 100 - vendidos.length;
    contadorPendientes.innerText = pendientes.length;
  });
}
