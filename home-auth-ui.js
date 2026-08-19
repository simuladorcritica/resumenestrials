import { currentUser, getProfile } from "./auth.js";

function integrarCuentaEnPortada() {
  const nav = document.querySelector(".top-links");
  if (nav && !document.getElementById("cuenta-link")) {
    nav.setAttribute("aria-label", "Cuenta y redes");
    const login = document.createElement("a");
    login.id = "login-link"; login.className = "auth-link auth-secondary"; login.href = "login.html"; login.textContent = "Entrar"; login.setAttribute("aria-label", "Iniciar sesión");
    const cuenta = document.createElement("a");
    cuenta.id = "cuenta-link"; cuenta.className = "auth-link auth-primary"; cuenta.href = "registro.html"; cuenta.textContent = "Crear cuenta"; cuenta.setAttribute("aria-label", "Crear cuenta");
    nav.prepend(login); nav.prepend(cuenta);
  }

  if (!document.getElementById("auth-ui-style")) {
    const style = document.createElement("style");
    style.id = "auth-ui-style";
    style.textContent = `
      .marca-top img{height:52px!important;width:auto!important;max-width:min(320px,38vw);object-fit:contain}
      .topbar-in{min-height:78px}
      .top-links .auth-link{width:auto;min-width:36px;padding:0 12px;border:1px solid rgba(15,95,95,.30);font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
      .top-links .auth-primary{background:var(--teal-hondo);color:#fff;border-color:var(--teal-hondo)}
      .top-links .auth-primary:hover{background:var(--teal);color:#fff;border-color:var(--teal)}
      .top-links .auth-secondary:hover{border-color:var(--teal)}
      .top-links .auth-user{text-transform:none;letter-spacing:.01em;gap:8px;padding:0 15px;min-height:40px;border-radius:999px;background:var(--teal-hondo);color:#fff;border-color:var(--teal-hondo);max-width:240px;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500}
      .top-links .auth-user::before{content:'';width:8px;height:8px;flex:none;border-radius:50%;background:#9ad9cf;box-shadow:0 0 0 3px rgba(154,217,207,.18)}
      .top-links .auth-user:hover{background:var(--teal);color:#fff;border-color:var(--teal)}
      .pie-bloque a.aviso-privacidad{color:var(--teal-hondo)}
      @media(max-width:760px){.marca-top img{height:44px!important;max-width:220px}.topbar-in{min-height:68px}}
      @media(max-width:520px){.topbar-in{padding-left:12px;padding-right:12px;gap:8px}.marca-top img{height:38px!important;max-width:165px}.top-links{gap:3px}.top-links .auth-link{padding:0 7px;font-size:9px}.top-links .auth-user{max-width:135px;min-height:34px}.top-links a:not(.auth-link){width:32px;height:32px}}
    `;
    document.head.appendChild(style);
  }

  const bloques = [...document.querySelectorAll(".pie-bloque")];
  const privacidad = bloques.find((b) => b.querySelector("h4")?.textContent.trim() === "Privacidad y contenido");
  const primerParrafo = privacidad?.querySelector("p");
  if (primerParrafo) primerParrafo.innerHTML = 'La navegación pública no requiere una cuenta ni utiliza cookies de publicidad. Si decides crear una cuenta, recabamos los datos necesarios para identificar tu perfil, autenticar el acceso y administrar tus preferencias. Los avisos por correo sobre nuevos resúmenes son opcionales y dependen de tu consentimiento. Consulta el <a class="aviso-privacidad" href="privacidad.html">Aviso de privacidad</a> para conocer qué datos tratamos, sus finalidades y cómo ejercer tus derechos.';
}

async function sincronizarSesion() {
  const cuenta = document.getElementById("cuenta-link"), login = document.getElementById("login-link");
  if (!cuenta) return;
  try {
    const user = await currentUser(); if (!user) return;
    let username = user.user_metadata?.username || "";
    try { const profile = await getProfile(); if (profile?.username) username = profile.username; } catch (error) { console.debug("No se pudo cargar el perfil para la cabecera:", error?.message || error); }
    cuenta.href = "cuenta.html"; cuenta.classList.remove("auth-primary"); cuenta.classList.add("auth-user"); cuenta.textContent = username || "Mi cuenta"; cuenta.setAttribute("aria-label", username ? `Abrir cuenta de ${username}` : "Abrir mi cuenta");
    if (login) login.remove();
  } catch (error) { console.debug("Sesión no disponible:", error?.message || error); }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", async()=>{integrarCuentaEnPortada();await sincronizarSesion();},{once:true}); else {integrarCuentaEnPortada();await sincronizarSesion();}
