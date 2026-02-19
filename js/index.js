// js/index.js
import "./config.js";
import { loginWithGoogle } from "./auth.js";
import { CLUB_DATA } from "./strings.js";

import "./config.js";
import { loadHeader } from "./components/header.js";
import { CLUB_DATA } from "./strings.js";

/* =========================================================
   HEADER
========================================================= */

loadHeader("home");

/* =========================================================
   HERO
========================================================= */

const heroTitle = document.querySelector(".hero h2");
const heroText = document.querySelector(".hero p");
const heroImg = document.querySelector(".hero-img");

const heroPrimaryCta = document.getElementById("heroPrimaryCta");
const heroWhatsappCta = document.getElementById("heroWhatsappCta");

if (heroTitle) {
  heroTitle.innerHTML =
    CLUB_DATA.landing.hero.title.replace(",", ",<br>");
}

if (heroText) {
  heroText.textContent = CLUB_DATA.landing.hero.description;
}

if (heroImg) {
  heroImg.src = CLUB_DATA.landing.hero.image;
  heroImg.alt = CLUB_DATA.club.name;
}

/* CTA principal */
if (heroPrimaryCta) {
  heroPrimaryCta.textContent =
    CLUB_DATA.landing.hero.cta.primary.label;
  heroPrimaryCta.href =
    CLUB_DATA.landing.hero.cta.primary.href;
}

/* CTA WhatsApp */
if (heroWhatsappCta) {
  const wa = CLUB_DATA.landing.contacts.whatsapp;

  heroWhatsappCta.textContent = "WhatsApp";
  heroWhatsappCta.href =
    `https://wa.me/${wa.phone.replace("+", "")}?text=${encodeURIComponent(
      wa.message
    )}`;
}

/* =========================================================
   EVENTS (Cartaglow y futuros)
========================================================= */

const eventsSection = document.getElementById("eventsSection");

if (eventsSection && CLUB_DATA.landing.events?.length) {
  const event = CLUB_DATA.landing.events[0];

  const titleEl = eventsSection.querySelector("h2");
  const descEl = eventsSection.querySelector("p");
  // Botón registro Cartaglow 2026 (deshabilitado)
  const registerBtn = document.createElement("button");
  registerBtn.className = "landing-btn landing-btn-disabled";
  registerBtn.textContent = "Registro Cartaglow 2026 (Próximamente)";
  registerBtn.disabled = true;
  registerBtn.title = "El registro para Cartaglow 2026 abrirá próximamente";
  eventsSection.appendChild(registerBtn);
  const eventsContainer = eventsSection.querySelector(".events");

  if (titleEl) {
    titleEl.textContent = `${event.name} ${event.edition}`;
  }

  if (descEl) {
    descEl.textContent =
      `${event.description} Contamos con ${event.participants} participantes en la edición ${event.edition}. Próxima edición en ${event.nextEdition.month} ${event.nextEdition.year}.`;
  }

  if (eventsContainer) {
    eventsContainer.innerHTML = "";

    event.images.forEach(src => {
    const link = document.createElement("a");
    link.href = "pages/public/cartaglow.html";
    link.className = "event-link";

    const img = document.createElement("img");
    img.src = src;
    img.alt = event.name;

    link.appendChild(img);
    eventsContainer.appendChild(link);
  });
  }
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

const trainingsWhatsappCta =
  document.getElementById("trainingsWhatsappCta");

if (trainingsWhatsappCta) {
  const wa = CLUB_DATA.landing.contacts.whatsapp;

  trainingsWhatsappCta.textContent = wa.label;
  trainingsWhatsappCta.href =
    `https://wa.me/${wa.phone.replace("+", "")}?text=${encodeURIComponent(
      wa.message
    )}`;
}

/* =========================================================
   HONORS / PALMARÉS
========================================================= */

const honorsSection = document.getElementById("honorsSection");

if (honorsSection) {
  honorsSection.querySelector("h2").textContent =
    CLUB_DATA.landing.honors.title;

  const container = honorsSection.querySelector(".landing-cards");
  container.innerHTML = "";

  CLUB_DATA.landing.honors.items.forEach(item => {
    let badge = "🏅";
    let className = "honor-card";

    if (item.position.toLowerCase().includes("primer")) {
      badge = "🥇";
      className += " honor-gold";
    } else if (item.position.toLowerCase().includes("segundo")) {
      badge = "🥈";
      className += " honor-silver";
    } else if (item.position.toLowerCase().includes("tercer")) {
      badge = "🥉";
      className += " honor-bronze";
    } else if (item.position.toLowerCase().includes("espíritu")) {
      badge = "🤝";
      className += " honor-spirit";
    }

    const card = document.createElement("div");
    card.className = className;

    card.innerHTML = `
      <div class="honor-badge">${badge}</div>
      <div class="honor-position">${item.position}</div>
      <div class="honor-tournament">${item.tournament}</div>
      <div class="honor-year">${item.year}</div>
    `;

    container.appendChild(card);
  });
}


/* =========================================================
   UNIFORMS (CAROUSEL)
========================================================= */

const uniformsSection = document.getElementById("uniformsSection");

if (uniformsSection) {
  uniformsSection.querySelector("h2").textContent =
    CLUB_DATA.landing.uniforms.title;

  uniformsSection.querySelector("p").textContent =
    CLUB_DATA.landing.uniforms.subtitle;

  const carouselInner = document.querySelector(
    "#uniformsCarousel .carousel-inner"
  );

  carouselInner.innerHTML = "";

  const itemsPerSlide = window.innerWidth < 768 ? 1 : 3;

  for (let i = 0; i < CLUB_DATA.landing.uniforms.items.length; i += itemsPerSlide) {
    const slideItems =
      CLUB_DATA.landing.uniforms.items.slice(i, i + itemsPerSlide);

    const slide = document.createElement("div");
    slide.className = `carousel-item ${i === 0 ? "active" : ""}`;

    const row = document.createElement("div");
    row.className = "uniform-row";

    slideItems.forEach(item => {
      const card = document.createElement("div");
      card.className = "uniform-card";

      card.innerHTML = `
        <div class="uniform-img-wrapper">
          <img src="${item.image}" alt="${item.name}" />
        </div>
        <div class="uniform-info">
          <h3>${item.name}</h3>
          <a
            class="landing-btn"
            href="${CLUB_DATA.landing.uniforms.orderUrl}"
            target="_blank"
          >
            ${CLUB_DATA.landing.uniforms.CTA}
          </a>
        </div>
      `;

      row.appendChild(card);
    });

    slide.appendChild(row);
    carouselInner.appendChild(slide);
  }
}

const carouselEl = document.getElementById("uniformsCarousel");
if (carouselEl) {
  new bootstrap.Carousel(carouselEl);
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


function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;

  loader.classList.add("hidden");

  // opcional: remover del DOM
  setTimeout(() => loader.remove(), 400);
}

hideLoader();