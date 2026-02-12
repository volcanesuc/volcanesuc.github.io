// js/ui/modal_host.js
let host, frame;

export function initModalHost(){
  host = document.getElementById("modalHost");
  frame = document.getElementById("modalFrame");
  if (!host || !frame) return;

  // cerrar click afuera
  host.addEventListener("click", (e) => {
    if (e.target === host) closeModal();
  });

  // ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !host.classList.contains("d-none")) closeModal();
  });

  // mensajes desde el iframe
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
}
