import { db } from "./firebase.js";
import { collection, addDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function savePlayer() {
  const name = document.getElementById("nameInput").value.trim();
  const number = Number(document.getElementById("numberInput").value);
  const status = document.getElementById("status");

  if (!name || !number) {
    status.textContent = "❌ Nombre y número son obligatorios";
    return;
  }

  const player = {
    name,
    normalized: normalize(name),
    number,
    active: true
  };

  try {
    await addDoc(collection(db, "club_players"), player);
    status.textContent = "✅ Jugador guardado";

    document.getElementById("nameInput").value = "";
    document.getElementById("numberInput").value = "";
  } catch (err) {
    console.error(err);
    status.textContent = "❌ Error al guardar";
  }
}

document
  .getElementById("saveBtn")
  .addEventListener("click", savePlayer);
