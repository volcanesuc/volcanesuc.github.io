// js/index.js
import { loginWithGoogle } from "./auth.js";

const loginBtn = document.getElementById("loginBtn");

loginBtn.addEventListener("click", loginWithGoogle);