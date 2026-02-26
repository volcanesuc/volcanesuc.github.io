// js/ui/loader.component.js
import { APP_CONFIG } from "../config/config.js";

const OVERLAY_ID = "loadingOverlay";
const STYLE_ID = "loaderStyles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    body.loading {
      overflow: hidden;
    }

    /* Overlay full-screen (más oscuro para tapar lo de abajo) */
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      display: none;              /* showLoader -> flex */
      align-items: center;
      justify-content: center;
      z-index: 99999;
      background: rgba(0,0,0,0.86);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }

    #${OVERLAY_ID} .loader-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      border-radius: 16px;
      background: rgba(10,10,12,0.35);
      box-shadow: 0 12px 34px rgba(0,0,0,0.45);
      border: 1px solid rgba(255,255,255,0.06);
    }

    /* Loader (tu diseño final) */
    #${OVERLAY_ID} .loader {
      width: 96px;
      height: 96px;
    }
    #${OVERLAY_ID} svg {
      width: 100%;
      height: 100%;
    }

    #${OVERLAY_ID} .disc {
    fill: var(--loader-primary);
    }

    #${OVERLAY_ID} .inner-ring {
    fill: none;
    stroke: var(--loader-ring);
    stroke-width: 3;
    }

    #${OVERLAY_ID} .star {
    fill: var(--loader-accent);
    transform-origin: 32px 32px;
    animation: loader-spin 3s linear infinite;
    }

    @keyframes loader-spin {
      to { transform: rotate(360deg); }
    }

    #${OVERLAY_ID} .loader-text {
      font-size: 0.98rem;
      color: rgba(255,255,255,0.86);
      letter-spacing: 0.2px;
      text-align: center;
      max-width: 280px;
    }
  `;
  document.head.appendChild(style);
}

function applyThemeVars() {
  const colors = APP_CONFIG?.theme?.colors || {};
  const root = document.documentElement;

  root.style.setProperty("--loader-primary", colors.primary);
  root.style.setProperty("--loader-accent", colors.accent);

  // 👇 el aro blanco puede ser configurable también
  root.style.setProperty("--loader-ring",colors.accentSoft || "#ffffff");
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;

  overlay.innerHTML = `
    <div class="loader-card" role="status" aria-live="polite" aria-label="Cargando">
      <div class="loader" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <!-- Círculo lleno -->
          <circle cx="32" cy="32" r="28" class="disc"></circle>

          <!-- Aro blanco DENTRO -->
          <circle cx="32" cy="32" r="23" class="inner-ring"></circle>

          <!-- Estrella girando -->
          <path class="star"
            d="M32 18
               L36 27
               L46 28
               L39 35
               L41 45
               L32 40
               L23 45
               L25 35
               L18 28
               L28 27 Z"></path>
        </svg>
      </div>

      <div class="loader-text" id="${OVERLAY_ID}Message">Cargando…</div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

export function mountLoader() {
  ensureStyles();
  applyThemeVars();
  return ensureOverlay();
}

export function setLoaderMessage(message = "Cargando…") {
  const overlay = mountLoader();
  const msgEl = overlay.querySelector(`#${OVERLAY_ID}Message`);
  if (msgEl) msgEl.textContent = message || "Cargando…";
}

export function showLoaderOverlay(message = "Cargando…") {
  const overlay = mountLoader();
  setLoaderMessage(message);
  overlay.style.display = "flex";
}

export function hideLoaderOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.style.display = "none";
}