// js/page-guard.js
import { loadHeaderTabsConfig, isTabEnabled } from "./remote-config.js";
import { PAGE_CONFIG, HOME_HREF } from "./config/page-config.js";

import { db } from "./firebase.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function loadUserRoleIntoCfg(cfg) {
  // Si no hay sesión aún, devolvemos cfg tal cual.
  const user = getAuth().currentUser;
  if (!user) return cfg;

  try {
    const ref = doc(db, "user_roles", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return cfg;

    const data = snap.data() || {};

    // Si manejás multi-club en el futuro, esto evita mezclar roles.
    // (si no existe cfg.club.id, igual no bloquea)
    const cfgClubId = cfg?.club?.id || cfg?.clubId || null;
    if (data.clubId && cfgClubId && data.clubId !== cfgClubId) return cfg;

    const role = (data.role || "").toString().toLowerCase().trim();
    const active = data.active !== false;

    // Si está inactivo, lo tratamos como viewer
    const finalRole = active && role ? role : "viewer";

    return {
      ...cfg,
      role: finalRole,
      isAdmin: finalRole === "admin",
      // opcional: por si luego querés mostrarlo
      userRole: finalRole
    };
  } catch (err) {
    console.warn("No se pudo cargar rol de usuario:", err);
    return cfg;
  }
}

export async function guardPage(pageKey) {
  // 1) carga config remota (tabs + club)
  let cfg = await loadHeaderTabsConfig();

  // 2) inyecta rol del usuario (si ya está logueado)
  cfg = await loadUserRoleIntoCfg(cfg);

  const page = PAGE_CONFIG[pageKey];
  if (!page) return { cfg };

  if (!isTabEnabled(page.tabId, cfg)) {
    window.location.href = HOME_HREF;
    return { cfg, redirected: true };
  }

  return { cfg, redirected: false };
}
