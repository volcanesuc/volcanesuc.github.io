// /js/ui/loader.preload.js
(function () {
  const OVERLAY_ID = "volcanesLoadingOverlay";
  const STYLE_ID = "volcanesPreloadLoaderStyles";

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.loading { overflow: hidden; }

      #${OVERLAY_ID}{
        position:fixed; inset:0;
        display:flex; align-items:center; justify-content:center;
        z-index:99999;
        background: rgba(0,0,0,0.88);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
      }
      #${OVERLAY_ID} .loader-card{
        display:flex; flex-direction:column; align-items:center; gap:14px;
        padding:18px 20px; border-radius:16px;
        background: rgba(10,10,12,0.38);
        box-shadow: 0 12px 34px rgba(0,0,0,0.46);
        border: 1px solid rgba(255,255,255,0.06);
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      }
      #${OVERLAY_ID} .loader{ width:96px; height:96px; }
      #${OVERLAY_ID} svg{ width:100%; height:100%; }
      #${OVERLAY_ID} .disc{ fill:#19473f; }
      #${OVERLAY_ID} .inner-ring{ fill:none; stroke:#fff; stroke-width:3; opacity:.92; }
      #${OVERLAY_ID} .star{
        fill:#e8ce26;
        transform-origin:32px 32px;
        animation: loader-spin 3s linear infinite;
      }
      @keyframes loader-spin { to { transform: rotate(360deg); } }
      #${OVERLAY_ID} .loader-text{
        font-size:.98rem; color: rgba(255,255,255,0.86);
        text-align:center; max-width:320px;
      }
    `;
    document.head.appendChild(style);
  }

  function injectOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.classList.add("is-visible");
      document.body?.classList.add("loading");
      return;
    }
    if (document.getElementById(OVERLAY_ID)) return;
    // si no existe, lo crea
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;

    // 🔥 clave: visible desde ya (por si luego entra el CSS “grande”)
    overlay.classList.add("is-visible");

    overlay.setAttribute("aria-hidden", "false");
    overlay.innerHTML = `
      <div class="loader-card" role="status" aria-live="polite" aria-label="Cargando">
        <div class="loader" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" class="disc"></circle>
            <circle cx="32" cy="32" r="23" class="inner-ring"></circle>
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

    document.body.classList.add("loading");
    document.body.appendChild(overlay);
  }

  if (document.body) injectOverlay();
  else {
    const mo = new MutationObserver(() => {
      if (document.body) {
        mo.disconnect();
        injectOverlay();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();