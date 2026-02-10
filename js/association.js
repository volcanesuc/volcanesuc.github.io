// js/association.js
import { guardPage } from "./page-guard.js";
import { loadHeader } from "./components/header.js";

// Tabs válidos (keys de URL)
const TABS = [
  { key: "memberships", label: "Membresías" },
  { key: "payments", label: "Pagos" },
  { key: "plans", label: "Planes" },
];

function getTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = (params.get("tab") || "memberships").toLowerCase();
  return TABS.some(t => t.key === tab) ? tab : "memberships";
}

function setTabInUrl(tab) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  history.pushState({}, "", url);
}

function renderTabs(activeTab) {
  const tabsHtml = TABS.map(t => {
    const activeClass = t.key === activeTab ? "is-active" : "";
    return `
      <button class="assoc-tab ${activeClass}" data-tab="${t.key}" type="button">
        ${t.label}
      </button>
    `;
  }).join("");

  return `
    <section class="assoc-shell">
      <div class="assoc-tabs">
        ${tabsHtml}
      </div>
      <div class="assoc-content" id="assoc-content"></div>
    </section>
  `;
}

// Carga dinámica del contenido del tab
async function loadTabContent(tab, cfg) {
  const mount = document.getElementById("assoc-content");
  if (!mount) return;

  // loader simple opcional
  mount.innerHTML = `<div style="padding:24px;">Cargando...</div>`;

  // Mapeo de tab -> módulo feature
  const loaders = {
    memberships: async () => {
      const mod = await import("./features/memberships_list.js");
      // convención: export async function mount(el, cfg)
      return mod.mount(mount, cfg);
    },
    payments: async () => {
      const mod = await import("./features/membership_pay.js");
      return mod.mount(mount, cfg);
    },
    plans: async () => {
      const mod = await import("./subscription_plans.js");
      // si subscription_plans.js no tiene mount, lo adaptamos (ver más abajo)
      return mod.mount ? mod.mount(mount, cfg) : (mount.innerHTML = "TODO: implementar mount() en plans");
    },
  };

  const fn = loaders[tab] || loaders.memberships;
  await fn();
}

async function renderAssociation(cfg) {
  const tab = getTabFromUrl();

  // Asegurate de tener un contenedor en el HTML (ej: <main id="page-content"></main>)
  const root = document.getElementById("page-content") || document.body;
  root.innerHTML = renderTabs(tab);

  // Eventos de tabs
  root.querySelectorAll(".assoc-tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nextTab = btn.dataset.tab;
      if (!nextTab) return;
      setTabInUrl(nextTab);
      // re-render solo tabs (para marcar activo) y contenido
      await renderAssociation(cfg);
    });
  });

  await loadTabContent(tab, cfg);
}

// --- Boot como attendance ---
const { cfg, redirected } = await guardPage("association");
if (!redirected) {
  await loadHeader("association", cfg);
  await renderAssociation(cfg);

  // Soporta back/forward del navegador
  window.addEventListener("popstate", () => renderAssociation(cfg));
}
