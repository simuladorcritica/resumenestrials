import { TURNSTILE_SITE_KEY } from './turnstile-config.js';

let scriptPromise = null;

function loadScript(){
  if(!TURNSTILE_SITE_KEY) return Promise.resolve(false);
  if(window.turnstile) return Promise.resolve(true);
  if(scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async=true;
    s.defer=true;
    s.onload=()=>resolve(true);
    s.onerror=()=>reject(new Error('No fue posible cargar la verificación anti-bot.'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function turnstileEnabled(){ return Boolean(TURNSTILE_SITE_KEY); }

export async function mountTurnstile(containerId, action){
  if(!TURNSTILE_SITE_KEY) return {enabled:false,getToken:()=>null,reset:()=>{}};
  await loadScript();
  const container=document.getElementById(containerId);
  if(!container) throw new Error('No se encontró el contenedor de seguridad.');

  container.style.minHeight='70px';
  container.style.margin='14px 0 18px';

  let token=null;
  const widgetId=window.turnstile.render(container,{
    sitekey:TURNSTILE_SITE_KEY,
    theme:'light',
    size:'flexible',
    language:'es',
    appearance:'always',
    execution:'render',
    retry:'auto',
    'refresh-expired':'auto',
    action,
    callback:(value)=>{token=value;},
    'expired-callback':()=>{token=null;},
    'timeout-callback':()=>{token=null;},
    'error-callback':()=>{token=null;}
  });

  return {
    enabled:true,
    getToken:()=>token,
    reset:()=>{
      token=null;
      window.turnstile?.reset(widgetId);
    }
  };
}
