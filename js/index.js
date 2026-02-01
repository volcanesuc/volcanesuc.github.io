// js/index.js
import { loginWithGoogle } from "./auth.js";
import { CLUB_STRINGS } from "./strings.js";

/* =========================================================
   HEADER
========================================================= */

document.getElementById("clubName").textContent =
  CLUB_STRINGS.club.name;

const loginBtn = document.getElementById("loginBtn");
loginBtn.textContent = CLUB_STRINGS.actions.login;
loginBtn.addEventListener("click", loginWithGoogle);

/* =========================================================
   HERO
========================================================= */

const heroSection = document.querySelector(".hero");

heroSection.querySelector("h2").innerHTML =
  CLUB_STRINGS.hero.title;

heroSection.querySelector("p").textContent =
  CLUB_STRINGS.hero.description;

heroSection.querySelector(".landing-btn").textContent =
  CLUB_STRINGS.hero.cta;

const heroImg = heroSection.querySelector(".hero-img");
heroImg.src = CLUB_STRINGS.hero.image;
heroImg.alt = CLUB_STRINGS.club.name;

/* =========================================================
   EVENTS / TORNEOS
========================================================= */

const eventsSection = document.getElementById("eventsSection");
const carousel = eventsSection.querySelector(".carousel");

const mainEvent = CLUB_STRINGS.events[0];

eventsSection.querySelector("h2").textContent = mainEvent.title;
eventsSection.querySelector("p").textContent = mainEvent.description;

carousel.innerHTML = mainEvent.images
  .map(src => `<img src="${src}" />`)
  .join("");

/* =========================================================
   TRAININGS
========================================================= */

const trainingsSection = document.getElementById("entrenamientos");
const trainingCards = trainingsSection.querySelectorAll(".landing-card");

trainingsSection.querySelector("h2").textContent =
  CLUB_STRINGS.trainings.title;

// Entrenamientos
trainingCards[0].querySelector("h3").textContent =
  CLUB_STRINGS.trainings.practice.title;

trainingCards[0].innerHTML += CLUB_STRINGS.trainings.practice.schedule
  .map(t => `<p>${t}</p>`)
  .join("");

// Juegos
trainingCards[1].querySelector("h3").textContent =
  CLUB_STRINGS.trainings.games.title;

trainingCards[1].innerHTML += CLUB_STRINGS.trainings.games.schedule
  .map(t => `<p>${t}</p>`)
  .join("");

/* =========================================================
   HONORS / PALMARÉS
========================================================= */

const honorsSection = document.getElementById("honorsSection");
const honorsContainer = honorsSection.querySelector(".landing-cards");

honorsSection.querySelector("h2").textContent =
  CLUB_STRINGS.honors.title;

honorsContainer.innerHTML = CLUB_STRINGS.honors.items
  .map(
    h => `
    <div class="landing-card">
      ${h.position}<br>
      <strong>${h.tournament}</strong><br>
      ${h.year}
    </div>
  `
  )
  .join("");

/* =========================================================
   UNIFORMS
========================================================= */

const uniformsSection = document.getElementById("uniformsSection");
const uniformsContainer = uniformsSection.querySelector(".landing-cards");

uniformsSection.querySelector("h2").textContent =
  CLUB_STRINGS.uniforms.title;

uniformsSection.querySelector("p").textContent =
  CLUB_STRINGS.uniforms.subtitle;

uniformsContainer.innerHTML = CLUB_STRINGS.uniforms.items
  .map(
    u => `
    <div class="landing-card">
      <img src="${u.image}" class="uniforme-img" />
      <h3>${u.name}</h3>
      <a class="landing-btn" href="${u.link}" target="_blank">
        ${CLUB_STRINGS.actions.orderUniform}
      </a>
    </div>
  `
  )
  .join("");

/* =========================================================
   FOOTER
========================================================= */

document.querySelector(".landing-footer").innerHTML = `
  <p>© ${CLUB_STRINGS.club.name}</p>
  <p>${CLUB_STRINGS.club.founded}</p>
`;
