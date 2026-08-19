import { RT_WEB_VERSION } from './app-version.js';

const KEY='rt_client_errors_v1';
const MAX=40;

function scrub(value){
  return String(value??'')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email]')
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g,'[token]')
    .slice(0,700);
}

function save(entry){
  try{
    const list=JSON.parse(localStorage.getItem(KEY)||'[]');
    list.unshift(entry);
    localStorage.setItem(KEY,JSON.stringify(list.slice(0,MAX)));
  }catch{}
}

export function recordClientError(type,message,extra={}){
  save({
    at:new Date().toISOString(),
    version:RT_WEB_VERSION,
    page:location.pathname,
    type:scrub(type),
    message:scrub(message),
    extra:Object.fromEntries(Object.entries(extra).map(([k,v])=>[k,scrub(v)]))
  });
}

window.addEventListener('error',e=>recordClientError('window.error',e.message,{source:e.filename,line:e.lineno,column:e.colno}));
window.addEventListener('unhandledrejection',e=>recordClientError('unhandledrejection',e.reason?.message||e.reason||'Promise rechazada'));

window.RTDiagnostics={
  version:RT_WEB_VERSION,
  getErrors(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}},
  clearErrors(){localStorage.removeItem(KEY)}
};
