import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const playersListDiv = document.getElementById("playersList");

async function loadPlayers() {
  playersListDiv.innerHTML = "Cargando jugadores...";

  try {
    const snapshot = await getDocs(collection(db, "club_players"));

    if (snapshot.empty) {
      playersListDiv.innerHTML = "No hay jugadores cargados";
      return;
    }

    playersListDiv.innerHTML = "";

    snapshot.forEach(doc => {
      const p = doc.data();

      const label = document.createElement("label");
      label.style.display = "block";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.playerId = doc.id;
      checkbox.dataset.playerName = p.name;

      label.appendChild(checkbox);
      label.append(` ${p.name} (#${p.number})`);

      playersListDiv.appendChild(label);
    });

  } catch (err) {
    console.error(err);
    playersListDiv.innerHTML = "❌ Error cargando jugadores";
  }
}

loadPlayers();
