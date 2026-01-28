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
  const birthdayInput = document.getElementById("birthday");
  const birthday = birthdayInput ? birthdayInput.value : null;

  if (!name || !number) {
    showMessage("❌ Nombre y número son obligatorios", "danger");
    return;
  }

  const player = {
    name,
    normalized: normalize(name),
    number,
    active: true
  };

  if (birthday) {
  player.birthday = birthday;
  }

  try {
    await addDoc(collection(db, "club_players"), player);
    showMessage("Jugador guardado ✅", "success");

    document.getElementById("nameInput").value = "";
    document.getElementById("numberInput").value = "";
  } catch (err) {
    console.error(err);
    showMessage("Error guardando jugador ❌", "danger");
  }
}

const statusMsg = document.getElementById("statusMsg");

function showMessage(text, type = "success") {
  statusMsg.innerHTML = `
    <div class="alert alert-${type}" role="alert">
      ${text}
    </div>
  `;
}

document
  .getElementById("saveBtn")
  .addEventListener("click", savePlayer);
