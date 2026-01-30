export function showLoader() {
  document.body.classList.add("loading");

  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";
}

export function hideLoader() {
  document.body.classList.remove("loading");

  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}
