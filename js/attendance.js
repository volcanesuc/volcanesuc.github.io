// attendance.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";

loadHeader("attendance");

const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");
const monthFilter = document.getElementById("monthFilter");
const clearFilterBtn = document.getElementById("clearFilter");

let allTrainings = {};
let allPlayers = {};
let allAttendance = [];
let attendanceChart;

document.getElementById("logoutBtn")?.addEventListener("click", logout);

watchAuth(async () => {
  showLoader();
  try {
    await loadAttendance();
    applyFilter(); // 👈 render inicial
  } catch (e) {
    console.error(e);
  } finally {
    hideLoader();
  }
});

async function loadAttendance() {
  allTrainings = {};
  allPlayers = {};
  allAttendance = [];

  const playersSnap = await getDocs(collection(db, "club_players"));
  playersSnap.forEach(d => {
    const p = d.data();
    allPlayers[d.id] = {
      name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—",
      count: 0
    };
  });

  const trainingsSnap = await getDocs(collection(db, "club_trainings"));
  trainingsSnap.forEach(d => {
    allTrainings[d.id] = { date: d.id, count: 0 };
  });

  const attendanceSnap = await getDocs(collection(db, "club_attendance"));
  attendanceSnap.forEach(d => allAttendance.push(d.data()));

  console.log("Players:", Object.keys(allPlayers).length);
  console.log("Trainings:", Object.keys(allTrainings).length);
  console.log("Attendance:", allAttendance.length);
}

function applyFilter() {
  const selectedMonth = monthFilter.value;

  const trainings = Object.values(allTrainings).filter(t =>
    selectedMonth ? t.date.startsWith(selectedMonth) : true
  );

  trainings.forEach(t => (t.count = 0));
  Object.values(allPlayers).forEach(p => (p.count = 0));

  const validTrainings = new Set(trainings.map(t => t.date));

  allAttendance.forEach(a => {
    if (!validTrainings.has(a.trainingId)) return;

    allTrainings[a.trainingId].count++;
    if (allPlayers[a.playerId]) {
      allPlayers[a.playerId].count++;
    }
  });

  renderTrainings(trainings);
  renderPlayers(Object.values(allPlayers), trainings.length);
  updateKPIs(trainings);
  renderTopPlayers();
  renderChart(trainings);
}

/* ==========================
   RENDERS
========================== */

function renderTrainings(list) {
  trainingsTable.innerHTML = list
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => `<tr><td>${t.date}</td><td>${t.count}</td></tr>`)
    .join("");
}

function renderPlayers(list, totalTrainings) {
  playersTable.innerHTML = list
    .sort((a, b) => b.count - a.count)
    .map(p => {
      const pct = totalTrainings
        ? Math.round((p.count / totalTrainings) * 100)
        : 0;
      return `<tr><td>${p.name}</td><td>${p.count}</td><td>${pct}%</td></tr>`;
    })
    .join("");
}

function updateKPIs(trainings) {
  const totalTrainings = trainings.length;
  const totalAttendance = trainings.reduce((sum, t) => sum + t.count, 0);
  const avg = totalTrainings
    ? (totalAttendance / totalTrainings).toFixed(1)
    : 0;

  document.getElementById("kpiTrainings").textContent = totalTrainings;
  document.getElementById("kpiAttendance").textContent = totalAttendance;
  document.getElementById("kpiAverage").textContent = avg;
}

function renderTopPlayers() {
  const top = Object.values(allPlayers)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const medals = ["🥇", "🥈", "🥉"];

  document.getElementById("topPlayers").innerHTML = top
    .map(
      (p, i) => `
      <li class="list-group-item d-flex justify-content-between">
        <span>${medals[i]} ${p.name}</span>
        <span class="fw-bold">${p.count}</span>
      </li>`
    )
    .join("");
}

/* ==========================
   CHART (LINE)
========================== */

function renderChart(trainings) {
  const labels = trainings
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => t.date);

  const data = trainings.map(t => t.count);

  const ctx = document.getElementById("attendanceChart");

  if (attendanceChart) attendanceChart.destroy();

  attendanceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Asistencia",
          data,
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

/* ==========================
   FILTROS
========================== */

monthFilter.onchange = applyFilter;

clearFilterBtn.onclick = () => {
  monthFilter.value = "";
  applyFilter();
};

document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;
