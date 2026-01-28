let loadingOverlay = null;

document.addEventListener("DOMContentLoaded", () => {
  loadingOverlay = document.getElementById("loadingOverlay");
});

export function showLoader() {
  if (loadingOverlay) {
    loadingOverlay.style.display = "flex";
  }
}

export function hideLoader() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add("hidden");
  setTimeout(() => loadingOverlay.remove(), 300);
}