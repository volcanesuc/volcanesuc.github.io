// js/ui/loadPartial.js

const __loadedPartials = new Set();

export async function loadPartialOnce(url, mountId) {
  // 1) no cargar 2 veces el mismo partial
  if (__loadedPartials.has(url)) return;

  // 2) encontrar el contenedor donde montar
  const mount = document.getElementById(mountId);
  if (!mount) {
    throw new Error(`loadPartialOnce: no existe el mountId "${mountId}"`);
  }

  // 3) fetch del partial
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${url} (${res.status})`);
  }

  const html = await res.text();

  // 4) parsear y montar (pueden ser varios nodos)
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  // mover todos los nodos al mount (no solo firstElementChild)
  while (wrapper.firstChild) {
    mount.appendChild(wrapper.firstChild);
  }

  __loadedPartials.add(url);
}
