import { currentUser, getProfile } from "./auth.js";

function configurarEntradaCuenta(el, { kicker, main, href, label, user = false }) {
  if (!el) return;
  el.href = href;
  el.className = `auth-entry${user ? " is-user" : ""}`;
  el.setAttribute("aria-label", label);
  el.replaceChildren();
  const top = document.createElement("span");
  top.className = "auth-entry-kicker";
  top.textContent = kicker;
  const primary = document.createElement("span");
  primary.className = "auth-entry-main";
  primary.textContent = main;
  el.append(top, primary);
}

function integrarCuentaEnPortada() {
  const nav = document.querySelector(".top-links");
  if (nav && !document.getElementById("account-entry")) {
    nav.setAttribute("aria-label", "Cuenta y redes");
    const entry = document.createElement("a");
    entry.id = "account-entry";
    configurarEntradaCuenta(entry, {
      kicker: "Tu evidencia",
      main: "Entrar o crear cuenta",
      href: "login.html",
      label: "Entrar o crear una cuenta en Resumenes Trials"
    });
    nav.prepend(entry);
  }

  if (!document.getElementById("auth-ui-style")) {
    const style = document.createElement("style");
    style.id = "auth-ui-style";
    style.textContent = `
      .marca-top img{height:52px!important;width:auto!important;max-width:min(320px,38vw);object-fit:contain}
      .topbar-in{min-height:78px}
      .top-links{gap:6px}
      .top-links .auth-entry{width:auto;height:auto;min-width:0;min-height:46px;padding:4px 14px 4px 16px;border:0;border-left:1px solid var(--linea);border-radius:0;background:transparent;color:var(--tinta);display:inline-flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;text-decoration:none;white-space:nowrap}
      .top-links .auth-entry:hover{background:transparent;color:var(--tinta)}
      .auth-entry-kicker{font:500 8.5px/1 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--tinta-2)}
      .auth-entry-main{font:500 15px/1.1 'Newsreader',Georgia,serif;color:var(--teal-hondo);transition:color .18s ease}
      .auth-entry:hover .auth-entry-main{color:var(--teal)}
      .auth-entry.is-user .auth-entry-kicker{text-transform:none;letter-spacing:.04em;max-width:180px;overflow:hidden;text-overflow:ellipsis}
      .auth-entry.is-user .auth-entry-main{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
      .pie-bloque a.aviso-privacidad{color:var(--teal-hondo)}
      @media(max-width:760px){.marca-top img{height:44px!important;max-width:220px}.topbar-in{min-height:68px}.top-links .auth-entry{min-height:40px;padding-left:11px;padding-right:10px}.auth-entry-main{font-size:13px}.auth-entry-kicker{font-size:8px}}
      @media(max-width:520px){.topbar-in{padding-left:12px;padding-right:12px;gap:8px}.marca-top img{height:38px!important;max-width:150px}.top-links{gap:2px}.top-links .auth-entry{padding-left:8px;padding-right:6px;border-left:0}.auth-entry-kicker{display:none}.auth-entry-main{font:500 9px/1.1 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase}.top-links a:not(.auth-entry){width:30px;height:30px}}
    `;
    document.head.appendChild(style);
  }

  const bloques = [...document.querySelectorAll(".pie-bloque")];
  const privacidad = bloques.find((b) => b.querySelector("h4")?.textContent.trim() === "Privacidad y contenido");
  const primerParrafo = privacidad?.querySelector("p");
  if (primerParrafo) primerParrafo.innerHTML = 'La navegación pública no requiere una cuenta ni utiliza cookies de publicidad. Si decides crear una cuenta, recabamos los datos necesarios para identificar tu perfil, autenticar el acceso y administrar tus preferencias. Los avisos por correo sobre nuevos resúmenes son opcionales y dependen de tu consentimiento. Consulta el <a class="aviso-privacidad" href="privacidad.html">Aviso de privacidad</a> para conocer qué datos tratamos, sus finalidades y cómo ejercer tus derechos.';
}

async function sincronizarSesion() {
  const entry = document.getElementById("account-entry");
  if (!entry) return;
  try {
    const user = await currentUser();
    if (!user) return;
    let username = user.user_metadata?.username || "";
    try {
      const profile = await getProfile();
      if (profile?.username) username = profile.username;
    } catch (error) {
      console.debug("No se pudo cargar el perfil para la cabecera:", error?.message || error);
    }
    configurarEntradaCuenta(entry, {
      kicker: username || "Cuenta personal",
      main: "Mi cuenta",
      href: "cuenta.html",
      label: username ? `Abrir cuenta de ${username}` : "Abrir mi cuenta",
      user: true
    });
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
