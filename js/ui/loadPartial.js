export async function loadPartialOnce(url, mountId) {
  if (document.getElementById(mountId)) return;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${url}`);
  }

  const html = await res.text();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  document.body.appendChild(wrapper.firstElementChild);
}