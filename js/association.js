// js/association.js
import { guardPage } from "./page-guard.js";
import { loadHeader } from "./components/header.js";

const TABS = ["memberships", "payments", "plans"];

function getTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = (params.get("tab") || "memberships").toLowerCase();
  return TABS.includes(tab) ? tab : "memberships";
}

function setTabInUrl(tab) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  history.pushState({}, "", url);
}

function setActiveTab(tab) {
  // nav pills
  document.querySelectorAll("#associationTabs .nav-link").forEach((a) => {
    const isActive = a.dataset.tab === tab;
    a.classList.toggle("active", isActive);
    a.setAttribute("aria-current", isActive ? "page" : "false");
  });

  // panels
  document.querySelectorAll("#associationContent .assoc-panel").forEach((p) => {
    const isThis = p.dataset.panel === tab;
    p.classList.toggle("d-none", !isThis);
  });
}

async function mountTab(tab, cfg) {
  // Panel visible
  const panel = document.querySelector(`#associationContent .assoc-panel[data-panel="${tab}"]`);
  if (!panel) return;

  // Creamos/aseguramos un contenedor de montaje dentro del panel
  let mount = panel.querySelector("[data-mount]");
  if (!mount) {
    // si el panel tiene placeholder card, lo dejamos arriba y montamos debajo,
    // o si preferís reemplazarlo, podés limpiar panel.innerHTML = "".
    mount = document.createElement("div");
    mount.setAttribute("data-mount", "true");
    mount.className = "mt-3";
    panel.appendChild(mount);
  }

  mount.innerHTML = `<div class="py-3">Cargando...</div>`;

  // Carga dinámica del feature
  if (tab === "memberships") {
    const mod = await import("./features/memberships_list.js");
    if (!mod.mount) {
      mount.innerHTML = `<div class="text-danger">memberships_list.js no exporta mount()</div>`;
      return;
    }
    await mod.mount(mount, cfg);
    return;
  }

  if (tab === "payments") {
    // OJO: membership_pay.js normalmente es “página de pago”, no admin pagos.
    // Igual lo dejo como lo tenías: si no exporta mount, va a mostrar error.
    const mod = await import("./features/membership_pay.js");
    if (!mod.mount) {
      mount.innerHTML = `<div class="text-muted">Pagos: aún no implementado como tab (falta export mount())</div>`;
      return;
    }
    await mod.mount(mount, cfg);
    return;
  }

  if (tab === "plans") {
    const mod = await import("./subscription_plans.js");
    if (!mod.mount) {
      mount.innerHTML = `<div class="text-muted">Planes: falta export mount() en subscription_plans.js</div>`;
      return;
    }
    await mod.mount(mount, cfg);
  }
}

async function renderAssociation(cfg) {
  const tab = getTabFromUrl();
  setActiveTab(tab);
  await mountTab(tab, cfg);
}

/* =========================
   Boot (igual a attendance)
========================= */
const { cfg, redirected } = await guardPage("association");
if (!redirected) {
  await loadHeader("association", cfg);

  // Intercepta clicks de tabs para que no recargue la página
  document.querySelectorAll("#associationTabs .nav-link").forEach((a) => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      const tab = a.dataset.tab;
      if (!tab) return;
      setTabInUrl(tab);
      await renderAssociation(cfg);
    });
  });

  await renderAssociation(cfg);

  // Back/forward
  window.addEventListener("popstate", () => renderAssociation(cfg));
}
