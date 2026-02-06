// attendance.js
import { db } from "./firebase.js";
import { watchAuth, logout } from "./auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { APP_CONFIG } from "./config.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { Player } from "./models/player.js";

import { guardPage } from "./page-guard.js";
import { loadHeader } from "./components/header.js";


// Header
const { cfg, redirected } = await guardPage("attendance");
if (!redirected) {
  await loadHeader("attendance", cfg);
}

/* ==========================
   COLLECTIONS (CONFIG)
========================== */
const PLAYERS_COL = APP_CONFIG?.club?.playersCollection || "club_players";
const TRAININGS_COL = APP_CONFIG?.club?.trainingsCollection || "trainings";

/* ==========================
   DOM
========================== */
const trainingsTable = document.getElementById("trainingsTable");
const playersTable = document.getElementById("playersTable");
const monthFilter = document.getElementById("monthFilter");
const clearFilterBtn = document.getElementById("clearFilter");

const trainingsCards = document.getElementById("trainingsCards"); // optional
const playersCards = document.getElementById("playersCards");     // optional
const playerSearch = document.getElementById("playerSearch");     // optional

const kpiAvgCard = document.getElementById("kpiAvgCard");
const chartPanel = document.getElementById("chartPanel");
const closeChartBtn = document.getElementById("closeChartBtn");

/* ==========================
   STATE
========================== */
let allTrainings = {};
let allPlayers = {};
let attendanceChart;

let filteredTrainings = [];
let filteredPlayersArr = [];

/* ==========================
   AUTH
========================== */
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

/* ==========================
   LOAD DATA
========================== */
async function loadAttendance() {
  allTrainings = {};
  allPlayers = {};

  // PLAYERS
  const playersSnap = await getDocs(collection(db, PLAYERS_COL));
  playersSnap.forEach(d => {
    const player = Player.fromFirestore(d);
    allPlayers[player.id] = { player, count: 0 };
  });

  // TRAININGS
  const trainingsSnap = await getDocs(collection(db, TRAININGS_COL));
  trainingsSnap.forEach(d => {
    const data = d.data();
    allTrainings[d.id] = {
      id: d.id,
      date: data.date,             // "YYYY-MM-DD"
      month: data.month,           // "YYYY-MM"
      attendees: data.attendees ?? [],
      count: 0
    };
  });

  console.log("Players:", Object.keys(allPlayers).length, `(${PLAYERS_COL})`);
  console.log("Trainings:", Object.keys(allTrainings).length, `(${TRAININGS_COL})`);
}

/* ==========================
   FILTER + COMPUTE
========================== */
function applyFilter() {
  const selectedMonth = monthFilter?.value;

  filteredTrainings = Object.values(allTrainings).filter(t =>
    selectedMonth ? t.month === selectedMonth : true
  );

  // Si hay filtro y no hay entrenos: muestra mensaje y aún así actualiza KPIs/top/chart en 0
  if (selectedMonth && filteredTrainings.length === 0) {
    if (trainingsTable) {
      trainingsTable.innerHTML =
        `<tr><td colspan="2" class="text-muted p-3">No hay entrenamientos registrados en este mes.</td></tr>`;
    }

    if (playersTable) {
      playersTable.innerHTML =
        `<tr><td colspan="3" class="text-muted p-3">No hay datos para calcular asistencia.</td></tr>`;
    }

    trainingsCards && (trainingsCards.innerHTML = "");
    playersCards && (playersCards.innerHTML = "");
  }

  // reset counts
  filteredTrainings.forEach(t => (t.count = 0));
  Object.values(allPlayers).forEach(p => (p.count = 0));

  // compute counts
  filteredTrainings.forEach(training => {
    training.count = training.attendees.length;
    training.attendees.forEach(playerId => {
      if (allPlayers[playerId]) allPlayers[playerId].count++;
    });
  });

  const totalTrainings = filteredTrainings.length;

  filteredPlayersArr = Object.values(allPlayers)
    .map(p => ({
      ...p,
      pct: totalTrainings ? Math.round((p.count / totalTrainings) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // search
  const q = (playerSearch?.value || "").trim().toLowerCase();
  const playersToRender = q
    ? filteredPlayersArr.filter(({ player }) =>
        (player.fullName || "").toLowerCase().includes(q)
      )
    : filteredPlayersArr;

  // renders
  renderTrainings(filteredTrainings);
  renderPlayers(playersToRender);
  updateKPIs(filteredTrainings);
  renderTopPlayers(filteredPlayersArr, totalTrainings);

  // roster activo (si tu modelo no tiene active, se cuenta igual)
  const activeRoster = Object.values(allPlayers).filter(p => p.player.active !== false).length;

  renderChart(filteredTrainings, activeRoster);
}

/* ==========================
   RENDERS
========================== */
function renderTrainings(list) {
  const sorted = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // TABLE (desktop)
  if (trainingsTable) {
    trainingsTable.innerHTML = sorted
      .map(t => {
        const pillClass = t.count >= 12 ? "pill pill--good" : "pill pill--warn";
        return `
          <tr>
            <td>${t.date ?? "—"}</td>
            <td><span class="${pillClass}">👥 ${t.count ?? 0}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // CARDS (mobile)
  if (trainingsCards) {
    trainingsCards.innerHTML = sorted
      .map(t => {
        const pillClass = t.count >= 12 ? "pill pill--good" : "pill pill--warn";
        return `
          <div class="mobile-card">
            <div class="mobile-card__title">${t.date ?? "—"}</div>
            <div class="mobile-card__row">
              <div class="mobile-card__sub">Asistencia</div>
              <span class="${pillClass}">👥 ${t.count ?? 0}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }
}

function renderPlayers(list) {
  const threshold = 66;

  // TABLE (desktop)
  if (playersTable) {
    playersTable.innerHTML = list
      .map(({ player, count, pct }) => {
        const pillClass = pct >= threshold ? "pill pill--good" : "pill pill--warn";
        const barColor = pct >= threshold ? "var(--club-green)" : "var(--club-yellow)";

        return `
          <tr>
            <td>${player.fullName ?? "—"}</td>
            <td>${count ?? 0}</td>
            <td>
              <div class="d-flex align-items-center gap-2">
                <div class="progress slim flex-grow-1" style="min-width:120px;">
                  <div class="progress-bar" style="width:${pct}%; background:${barColor};"></div>
                </div>
                <span class="${pillClass}">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // CARDS (mobile)
  if (playersCards) {
    playersCards.innerHTML = list
      .slice(0, 50)
      .map(({ player, count, pct }) => {
        const pillClass = pct >= threshold ? "pill pill--good" : "pill pill--warn";
        const barColor = pct >= threshold ? "var(--club-green)" : "var(--club-yellow)";

        return `
          <div class="mobile-card">
            <div class="mobile-card__title">${player.fullName ?? "—"}</div>
            <div class="mobile-card__sub">${count ?? 0} asistencias</div>

            <div class="mobile-card__row">
              <div class="progress slim flex-grow-1">
                <div class="progress-bar" style="width:${pct}%; background:${barColor};"></div>
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
  const totalAttendance = trainings.reduce((sum, t) => sum + (t.count || 0), 0);
  const avg = totalTrainings ? (totalAttendance / totalTrainings).toFixed(1) : "0";

  document.getElementById("kpiTrainings").textContent = totalTrainings;
  document.getElementById("kpiAttendance").textContent = totalAttendance;
  document.getElementById("kpiAverage").textContent = avg;
}

function renderTopPlayers(playersArr, totalTrainings) {
  const top = playersArr.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const maxCount = top[0]?.count || 1;

  const el = document.getElementById("topPlayers");
  if (!el) return;

  el.innerHTML = top
    .map(({ player, count, pct }, i) => {
      const w = Math.round(((count || 0) / maxCount) * 100);
      return `
        <div class="top3-card">
          <div class="top3-row">
            <div>
              <div class="top3-name">${medals[i]} ${player.fullName ?? "—"}</div>
              <div class="top3-meta">${count ?? 0} de ${totalTrainings} · ${pct ?? 0}%</div>
            </div>
            <span class="pill pill--good">${count ?? 0}</span>
          </div>
          <div class="mini-bar"><div style="width:${w}%"></div></div>
        </div>
      `;
    })
    .join("");
}

/* ==========================
   CHART
========================== */
function renderChart(trainings, activeRoster = 0) {
  const canvas = document.getElementById("attendanceChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const threshold = 66;

  const sorted = [...trainings].sort((a, b) => (a.date || "").localeCompare(a.date || ""));
  const labels = sorted.map(t => t.date ?? "—");

  const values = sorted.map(t => {
    if (activeRoster > 0) return Math.round(((t.count || 0) / activeRoster) * 1000) / 10;
    return t.count || 0;
  });

  if (attendanceChart) attendanceChart.destroy();

  attendanceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: activeRoster > 0 ? "% Asistencia" : "Asistencia",
          data: values,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: (c) => {
            const v = c.raw ?? 0;
            if (activeRoster > 0) return v >= threshold ? "#198754" : "#e8ce26";
            return "#19473f";
          },
          segment: activeRoster > 0
            ? {
                borderColor: (seg) => {
                  const y0 = seg.p0.parsed.y ?? 0;
                  const y1 = seg.p1.parsed.y ?? 0;
                  const avg = (y0 + y1) / 2;
                  return avg >= threshold ? "#198754" : "#e8ce26";
                }
              }
            : {}
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => (activeRoster > 0 ? `${c.raw}%` : `${c.raw}`) }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: activeRoster > 0 ? 100 : undefined,
          ticks: { callback: (v) => (activeRoster > 0 ? `${v}%` : `${v}`) }
        }
      }
    }
  });
}

/* ==========================
   UI EVENTS
========================== */
monthFilter && (monthFilter.onchange = applyFilter);

clearFilterBtn && (clearFilterBtn.onclick = () => {
  monthFilter.value = "";
  applyFilter();
});

playerSearch?.addEventListener("input", applyFilter);

function showChartPanel() {
  if (!chartPanel) return;
  chartPanel.classList.remove("d-none");
  const activeRoster = Object.values(allPlayers).filter(p => p.player.active !== false).length;
  renderChart(filteredTrainings, activeRoster);
}

function hideChartPanel() {
  chartPanel?.classList.add("d-none");
}

kpiAvgCard?.addEventListener("click", showChartPanel);
kpiAvgCard?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") showChartPanel();
});
closeChartBtn?.addEventListener("click", hideChartPanel);

/* ==========================
   VERSION
========================== */
const v = document.getElementById("appVersion");
if (v) v.textContent = `v${APP_CONFIG.version}`;
