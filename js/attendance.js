import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./main.js";

const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");
const monthFilter = document.getElementById("monthFilter");
const clearFilterBtn = document.getElementById("clearFilter");

let allTrainings = {};
let allPlayers = {};
let allAttendance = [];

watchAuth(() => loadAttendance());

document.getElementById("logoutBtn")?.addEventListener("click", logout);

async function loadAttendance() {
  showLoader();

  try {
    const playersSnap = await getDocs(collection(db, "club_players"));
    playersSnap.forEach(d => {
      allPlayers[d.id] = { name: d.data().name, count: 0 };
    });

    const trainingsSnap = await getDocs(collection(db, "club_trainings"));
    trainingsSnap.forEach(d => {
      allTrainings[d.id] = { date: d.id, count: 0 };
    });

    const attendanceSnap = await getDocs(collection(db, "club_attendance"));
    attendanceSnap.forEach(d => allAttendance.push(d.data()));

    applyFilter();
  } catch (e) {
    console.error("Error asistencia", e);
  } finally {
    hideLoader();
  }
}

function applyFilter() {
  const selectedMonth = monthFilter.value;

  const trainings = Object.values(allTrainings).filter(t =>
    selectedMonth ? t.date.startsWith(selectedMonth) : true
  );

  trainings.forEach(t => t.count = 0);
  Object.values(allPlayers).forEach(p => p.count = 0);

  const validIds = new Set(trainings.map(t => t.date));

  allAttendance.forEach(a => {
    if (!validIds.has(a.trainingId)) return;
    allTrainings[a.trainingId]?.count++;
    allPlayers[a.playerId]?.count++;
  });

  renderTrainings(trainings);
  renderPlayers(Object.values(allPlayers), trainings.length);
}

function renderTrainings(list) {
  trainingsTable.innerHTML = list
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => `<tr><td>${t.date}</td><td>${t.count}</td></tr>`)
    .join("");
}

function renderPlayers(list, total) {
  playersTable.innerHTML = list
    .sort((a, b) => b.count - a.count)
    .map(p => {
      const pct = total ? Math.round((p.count / total) * 100) : 0;
      return `<tr><td>${p.name}</td><td>${p.count}</td><td>${pct}%</td></tr>`;
    })
    .join("");
}

monthFilter.onchange = applyFilter;
clearFilterBtn.onclick = () => {
  monthFilter.value = "";
  applyFilter();
};

document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;
