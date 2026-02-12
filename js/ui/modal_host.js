// js/ui/modal_host.js
let host, frame;

function cleanupBackdrops(){
  // Backdrops de bootstrap que a veces quedan pegados
  document.querySelectorAll(".modal-backdrop, .offcanvas-backdrop").forEach(el => el.remove());
  document.body.classList.remove("modal-open", "offcanvas-backdrop");
}

export function initModalHost(){
  host = document.getElementById("modalHost");
  frame = document.getElementById("modalFrame");
  if (!host || !frame) return;

  host.addEventListener("click", (e) => {
    if (e.target === host) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !host.classList.contains("d-none")) closeModal();
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data || {};
    if (msg.type === "modal:close") closeModal();
    if (msg.type === "associate:saved"){
      closeModal();
      window.dispatchEvent(new CustomEvent("associate:saved", { detail: msg.detail || {} }));
    }
  });
}

export function openModal(url){
  if (!host || !frame) initModalHost();

  cleanupBackdrops();             // ✅ antes de abrir
  frame.src = url;

  host.classList.remove("d-none");
  host.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

export function closeModal(){
  if (!host || !frame) return;

  host.classList.add("d-none");
  host.setAttribute("aria-hidden", "true");
  frame.src = "about:blank";

  document.body.style.overflow = "";
  cleanupBackdrops();             // ✅ después de cerrar
}
