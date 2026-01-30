//attendace.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";


loadHeader("attendance");

watchAuth(async () => {
  showLoader();
  try {
    await loadAttendance();
  } finally {
    hideLoader();
  }
});

const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");
const monthFilter = document.getElementById("monthFilter");
const clearFilterBtn = document.getElementById("clearFilter");

//Variables globales
let allTrainings = {};
let allPlayers = {};
let allAttendance = [];
let attendanceChart;


document.getElementById("logoutBtn")?.addEventListener("click", logout);

async function loadAttendance() {

  console.log("Players:", Object.keys(allPlayers).length);
  console.log("Trainings:", Object.keys(allTrainings).length);
  console.log("Attendance:", allAttendance.length);

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

    if (allTrainings[a.trainingId]) {
      allTrainings[a.trainingId].count += 1;
    }

    if (allPlayers[a.playerId]) {
      allPlayers[a.playerId].count += 1;
    }
  });

  //inicializar componentes
  renderTrainings(trainings);
  renderPlayers(Object.values(allPlayers), trainings.length);
  updateKPIs(trainings);
  renderTopPlayers();
  renderChart(currentMonth);
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

function updateKPIs(trainings) {
  const totalTrainings = trainings.length;

  const totalAttendance = trainings.reduce(
    (sum, t) => sum + t.count,
    0
  );

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
    .map((p, i) => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${medals[i]} ${p.name}</span>
        <span class="fw-bold">${p.count}</span>
      </li>
    `)
    .join("");
}

//Grafico de asistencia
function getMonthlyChartData(month) {
  const map = {};

  allAttendance.forEach(a => {
    if (!a.trainingId.startsWith(month)) return;
    map[a.trainingId] = (map[a.trainingId] || 0) + 1;
  });

  const labels = Object.keys(map).sort();
  const data = labels.map(d => map[d]);

  return { labels, data };
}

function renderChart(month) {
  const ctx = document.getElementById("attendanceChart");

  const { labels, data } = getMonthlyChartData(month);

  if (attendanceChart) attendanceChart.destroy();

  attendanceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Asistencias",
        data
      }]
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


//Filtro para el grafico
const chartMonthFilter = document.getElementById("chartMonthFilter");

chartMonthFilter.onchange = () => {
  if (chartMonthFilter.value) {
    renderChart(chartMonthFilter.value);
  }
};

//Filtro para la tabla
monthFilter.onchange = applyFilter;
clearFilterBtn.onclick = () => {
  monthFilter.value = "";
  applyFilter();
};


//Setear la version
document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;
