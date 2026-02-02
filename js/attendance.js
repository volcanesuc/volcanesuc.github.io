// attendance.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { loadHeader } from "./components/header.js";
import { Player } from "./models/player.js";

loadHeader("attendance");

const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");
const monthFilter = document.getElementById("monthFilter");
const clearFilterBtn = document.getElementById("clearFilter");
const trainingsCards = document.getElementById("trainingsCards");
const playersCards = document.getElementById("playersCards");
const playerSearch = document.getElementById("playerSearch");

let allTrainings = {};
let allPlayers = {};
let attendanceChart;
let filteredTrainings = [];
let filteredPlayersArr = [];

document.getElementById("logoutBtn")?.addEventListener("click", logout);

watchAuth(async () => {
  showLoader();
  try {
    await loadAttendance();
    applyFilter(); // render inicial
  } catch (e) {
    console.error(e);
  } finally {
    hideLoader();
  }
});

async function loadAttendance() {
  allTrainings = {};
  allPlayers = {};

  // PLAYERS
  const playersSnap = await getDocs(collection(db, "club_players"));
  playersSnap.forEach(d => {
    const player = Player.fromFirestore(d);
    allPlayers[player.id] = {
      player,
      count: 0
    };
  });

  // TRAININGS (nuevo modelo)
  const trainingsSnap = await getDocs(collection(db, "trainings"));
  trainingsSnap.forEach(d => {
    const data = d.data();

    allTrainings[d.id] = {
      id: d.id,
      date: data.date,
      month: data.month,
      attendees: data.attendees ?? [],
      count: 0
    };
  });

  console.log("Players:", Object.keys(allPlayers).length);
  console.log("Trainings:", Object.keys(allTrainings).length);
}


function applyFilter() {
  const selectedMonth = monthFilter.value;

  filteredTrainings = Object.values(allTrainings).filter(t =>
    selectedMonth ? t.month === selectedMonth : true
  );

  if (monthFilter.value && filteredTrainings.length === 0) {
    trainingsTable.innerHTML = `<tr><td colspan="2" class="text-muted p-3">No hay entrenamientos registrados en este mes.</td></tr>`;
    playersTable.innerHTML = `<tr><td colspan="3" class="text-muted p-3">No hay datos para calcular asistencia.</td></tr>`;
  }

  // reset counts
  filteredTrainings.forEach(t => (t.count = 0));
  Object.values(allPlayers).forEach(p => (p.count = 0));

  filteredTrainings.forEach(training => {
    training.count = training.attendees.length;

    training.attendees.forEach(playerId => {
      if (allPlayers[playerId]) {
        allPlayers[playerId].count++;
      }
    });
  });

  const totalTrainings = filteredTrainings.length;

  // array para render
  filteredPlayersArr = Object.values(allPlayers)
    .map(p => ({
      ...p,
      pct: totalTrainings ? Math.round((p.count / totalTrainings) * 100) : 0,
      missed: totalTrainings ? (totalTrainings - p.count) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // aplica search si hay
  const q = (playerSearch?.value || "").trim().toLowerCase();
  const playersToRender = q
    ? filteredPlayersArr.filter(({ player }) => player.fullName.toLowerCase().includes(q))
    : filteredPlayersArr;

  renderTrainings(filteredTrainings);
  renderPlayers(playersToRender, totalTrainings);
  updateKPIs(filteredTrainings);
  renderTopPlayers(filteredPlayersArr, totalTrainings);
  renderChart(filteredTrainings);
}


/* ==========================
   RENDERS
========================== */

function renderTrainings(list) {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));

  // TABLE (desktop)
  trainingsTable.innerHTML = sorted
    .map(t => {
      const pillClass = t.count >= 12 ? "pill pill--good" : "pill pill--warn";
      return `
        <tr>
          <td>${t.date}</td>
          <td>
            <span class="${pillClass}">👥 ${t.count}</span>
          </td>
        </tr>`;
    })
    .join("");

  // CARDS (mobile)
  if (trainingsCards) {
    trainingsCards.innerHTML = sorted
      .map(t => {
        const pillClass = t.count >= 12 ? "pill pill--good" : "pill pill--warn";
        return `
          <div class="mobile-card">
            <div class="mobile-card__title">${t.date}</div>
            <div class="mobile-card__row">
              <div class="mobile-card__sub">Asistencia</div>
              <span class="${pillClass}">👥 ${t.count}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }
}


function renderPlayers(list, totalTrainings) {
  // TABLE (desktop)
  playersTable.innerHTML = list
    .map(({ player, count, pct, missed }) => {
      const pillClass = pct >= 70 ? "pill pill--good" : "pill pill--warn";
      return `
        <tr>
          <td>${player.fullName}</td>
          <td>${count}</td>
          <td>
            <div class="d-flex align-items-center gap-2">
              <div class="progress slim flex-grow-1" style="min-width:120px;">
                <div class="progress-bar" style="width:${pct}%"></div>
              </div>
              <span class="${pillClass}">${pct}%</span>
              <span class="text-muted small d-none d-lg-inline">faltó ${missed}</span>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // CARDS (mobile)
  if (playersCards) {
    playersCards.innerHTML = list
      .slice(0, 50) // evita infinito en móvil; ajustá si querés
      .map(({ player, count, pct, missed }) => {
        const pillClass = pct >= 70 ? "pill pill--good" : "pill pill--warn";
        return `
          <div class="mobile-card">
            <div class="mobile-card__title">${player.fullName}</div>
            <div class="mobile-card__sub">${count} asistencias · faltó ${missed} de ${totalTrainings}</div>

            <div class="mobile-card__row">
              <div class="progress slim flex-grow-1">
                <div class="progress-bar" style="width:${pct}%"></div>
              </div>
              <span class="${pillClass}">${pct}%</span>
            </div>
          </div>
        `;
      })
      .join("");
  }
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

function renderTopPlayers(playersArr, totalTrainings) {
  const top = playersArr.slice(0, 3);

  const medals = ["🥇", "🥈", "🥉"];
  const maxCount = top[0]?.count || 1;

  document.getElementById("topPlayers").innerHTML = top
    .map(({ player, count, pct }, i) => {
      const w = Math.round((count / maxCount) * 100);
      return `
        <div class="top3-card">
          <div class="top3-row">
            <div>
              <div class="top3-name">${medals[i]} ${player.fullName}</div>
              <div class="top3-meta">${count} de ${totalTrainings} · ${pct}%</div>
            </div>
            <span class="pill pill--good">${count}</span>
          </div>
          <div class="mini-bar"><div style="width:${w}%"></div></div>
        </div>
      `;
    })
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

playerSearch?.addEventListener("input", applyFilter);

document.getElementById("appVersion").textContent = `v${APP_CONFIG.version}`;
