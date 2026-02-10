// js/association.js
import { guardPage } from "./guard.js";              // ajustá si tu ruta/nombre difiere
import { loadHeader } from "./components/header.js"; // tu header actual

function getTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("tab") || "memberships").toLowerCase();
}

function setActiveTab(tab) {
  // activar pill
  const links = document.querySelectorAll("#associationTabs .nav-link");
  links.forEach(a => {
    const isActive = a.dataset.tab === tab;
    a.classList.toggle("active", isActive);
    a.setAttribute("aria-current", isActive ? "page" : "false");
  });

  // mostrar panel
  const panels = document.querySelectorAll(".assoc-panel");
  panels.forEach(p => {
    const show = p.dataset.panel === tab;
    p.classList.toggle("d-none", !show);
  });
}

async function init() {
  // Header / auth guard
  const { cfg, redirected } = await guardPage("association");
  if (redirected) return;

  await loadHeader("association", cfg);

  // Tabs
  const tab = getTabFromUrl();
  setActiveTab(["memberships", "payments", "plans"].includes(tab) ? tab : "memberships");

  // QOL: si cambian tabs sin recargar (click ya navega, esto es opcional)
  // (si querés SPA, lo hacemos luego)
}

init();
