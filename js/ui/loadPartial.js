// js/ui/loadPartial.js
export async function loadPartialOnce(url, mountId = "modalMount") {
  const mount = document.getElementById(mountId);
  if (!mount) {
    throw new Error(`No existe el mount #${mountId} en el HTML`);
  }

  // Evita cargar 2 veces el mismo partial
  const key = `partial:${url}`;
  if (mount.dataset[key]) return;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);

  const html = await res.text();

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();

  const el = wrapper.firstElementChild;
  if (!el) throw new Error(`El partial ${url} vino vacío`);

  mount.appendChild(el);
  mount.dataset[key] = "1";
}
