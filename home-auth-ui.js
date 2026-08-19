import { currentUser } from "./auth.js";

function integrarCuentaEnPortada() {
  const nav = document.querySelector(".top-links");
  if (nav && !document.getElementById("cuenta-link")) {
    nav.setAttribute("aria-label", "Cuenta y redes");
    const link = document.createElement("a");
    link.id = "cuenta-link";
    link.className = "auth-link";
    link.href = "registro.html";
    link.textContent = "Crear cuenta";
    link.setAttribute("aria-label", "Crear cuenta");
    nav.prepend(link);
  }

  if (!document.getElementById("auth-ui-style")) {
    const style = document.createElement("style");
    style.id = "auth-ui-style";
    style.textContent = `
      .top-links .auth-link {
        width: auto; min-width: 36px; padding: 0 11px;
        border: 1px solid rgba(15,95,95,.30);
        font-family: 'IBM Plex Mono', monospace; font-size: 11px;
        letter-spacing: .06em; text-transform: uppercase; white-space: nowrap;
      }
      .top-links .auth-link:hover { border-color: var(--teal); }
      .pie-bloque a.aviso-privacidad { color: var(--teal-hondo); }
      @media (max-width: 520px) {
        .topbar-in { padding-left: 14px; padding-right: 14px; }
        .marca-top img { height: 26px; }
        .top-links { gap: 4px; }
        .top-links .auth-link { padding: 0 8px; font-size: 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  const bloques = [...document.querySelectorAll(".pie-bloque")];
  const privacidad = bloques.find((b) => b.querySelector("h4")?.textContent.trim() === "Privacidad y contenido");
  const primerParrafo = privacidad?.querySelector("p");
  if (primerParrafo) {
    primerParrafo.innerHTML = 'La navegación pública no requiere una cuenta ni utiliza cookies de publicidad. Si decides crear una cuenta, recabamos los datos necesarios para identificar tu perfil, autenticar el acceso y administrar tus preferencias. Los avisos por correo sobre nuevos resúmenes son opcionales y dependen de tu consentimiento. Consulta el <a class="aviso-privacidad" href="privacidad.html">Aviso de privacidad</a> para conocer qué datos tratamos, sus finalidades y cómo ejercer tus derechos.';
  }
}

async function sincronizarSesion() {
  const link = document.getElementById("cuenta-link");
  if (!link) return;
  try {
    const user = await currentUser();
    if (user) {
      link.href = "cuenta.html";
      link.textContent = "Mi cuenta";
      link.setAttribute("aria-label", "Abrir mi cuenta");
    }
  } catch (error) {
    console.debug("Sesión no disponible:", error?.message || error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => {
    integrarCuentaEnPortada();
    await sincronizarSesion();
  }, { once: true });
} else {
  integrarCuentaEnPortada();
  await sincronizarSesion();
}
