// js/index.js
import { loginWithGoogle } from "./auth.js";
import { CLUB_DATA } from "./strings.js";

/* =========================================================
   HEADER
========================================================= */

const headerTitle = document.querySelector(".club-name");
const headerCtaBtn = document.getElementById("loginBtn");



//LOGIN ACTION
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", loginWithGoogle);
}

/* =========================================================
   HERO
========================================================= */

const heroTitle = document.querySelector(".hero h2");
const heroText = document.querySelector(".hero p");
const heroCta = document.querySelector(".hero .landing-btn");
const heroImg = document.querySelector(".hero-img");

if (heroTitle) heroTitle.innerHTML = CLUB_DATA.landing.hero.title.replace("\n", "<br>");
if (heroText) heroText.textContent = CLUB_DATA.landing.hero.description;
if (heroCta) heroCta.textContent = CLUB_DATA.landing.hero.cta;
heroImg.src = CLUB_DATA.landing.hero.image;

/* =========================================================
   EVENTS (Cartaglow y futuros)
========================================================= */

const eventsSection = document.querySelectorAll(".landing-section")[1];

if (eventsSection) {
  const event = CLUB_DATA.landing.events[0]; // por ahora mostramos el primero

  eventsSection.querySelector("h2").textContent =
    `${event.name} ${event.edition}`;

  eventsSection.querySelector("p").textContent =
    `${event.description} Contamos con ${event.participants} participantes en la edición ${event.edition}. Próxima edición en ${event.nextEdition.month} ${event.nextEdition.year}.`;

  const carousel = eventsSection.querySelector(".carousel");
  carousel.innerHTML = "";

  event.images.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = event.name;
    carousel.appendChild(img);
  });
}

/* =========================================================
   TRAININGS & GAMES
========================================================= */

const trainingsSection = document.getElementById("entrenamientos");

if (trainingsSection) {
  trainingsSection.querySelector("h2").textContent =
    CLUB_DATA.landing.trainings.title;

  const cards = trainingsSection.querySelectorAll(".landing-card");

  CLUB_DATA.landing.trainings.blocks.forEach((block, index) => {
    const card = cards[index];
    if (!card) return;

    card.querySelector("h3").textContent = block.name;

    const content = block.schedule
      .map(s => `${s.day}: ${s.time}`)
      .join("\n");

    card.querySelectorAll("p").forEach(p => p.remove());

    content.split("\n").forEach(line => {
      const p = document.createElement("p");
      p.textContent = line;
      card.appendChild(p);
    });
  });
}

/* =========================================================
   HONORS / PALMARÉS
========================================================= */

const honorsSection = document.querySelectorAll(".landing-section")[3];

if (honorsSection) {
  honorsSection.querySelector("h2").textContent =
    CLUB_DATA.landing.honors.title;

  const container = honorsSection.querySelector(".landing-cards");
  container.innerHTML = "";

  CLUB_DATA.landing.honors.items.forEach(item => {
    const div = document.createElement("div");
    div.className = "landing-card";
    div.innerHTML = `
      ${item.position}<br>
      <strong>${item.tournament}</strong><br>
      ${item.year}
    `;
    container.appendChild(div);
  });
}

/* =========================================================
   UNIFORMS
========================================================= */

const uniformsSection = document.querySelectorAll(".landing-section")[4];

if (uniformsSection) {
  uniformsSection.querySelector("h2").textContent =
    CLUB_DATA.landing.uniforms.title;

  uniformsSection.querySelector("p").textContent =
    CLUB_DATA.landing.uniforms.subtitle;

  const container = uniformsSection.querySelector(".landing-cards");
  container.innerHTML = "";

  CLUB_DATA.landing.uniforms.items.forEach(item => {
    const card = document.createElement("div");
    card.className = "landing-card";

    card.innerHTML = `
      <img src="${item.image}" class="uniforme-img" />
      <h3>${item.name}</h3>
      <a class="landing-btn" href="${CLUB_DATA.landing.uniforms.orderUrl}" target="_blank">
        Pedir uniforme
      </a>
    `;

    container.appendChild(card);
  });
}

/* =========================================================
   FOOTER
========================================================= */

const footer = document.querySelector(".landing-footer");

if (footer) {
  footer.innerHTML = `
    <p>${CLUB_DATA.footer.copyright}</p>
    <p>Fundados en el ${CLUB_DATA.club.foundedYear}</p>
  `;
}
