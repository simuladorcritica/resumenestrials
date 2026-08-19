import { supabase, currentUser } from './auth.js';

const MAX_IDS=500;

function uniqIds(values){
  return [...new Set((Array.isArray(values)?values:[]).map(v=>String(v)).filter(Boolean))].slice(0,MAX_IDS);
}

export async function getLibraryState(){
  const user=await currentUser().catch(()=>null);
  if(!user) return {signedIn:false,user:null,favorites:[],read:[],lastVisit:null,preferences:{}};
  const meta=user.user_metadata||{};
  return {
    signedIn:true,
    user,
    favorites:uniqIds(meta.rt_favorites),
    read:uniqIds(meta.rt_read),
    lastVisit:meta.rt_last_visit||null,
    preferences:meta.preferences||{}
  };
}

async function patchMetadata(patch){
  const user=await currentUser();
  if(!user) throw new Error('Debes iniciar sesión.');
  const current=user.user_metadata||{};
  const {data,error}=await supabase.auth.updateUser({data:{...current,...patch}});
  if(error) throw error;
  return data.user;
}

export async function toggleFavorite(id){
  const state=await getLibraryState();
  if(!state.signedIn) throw new Error('Debes iniciar sesión para guardar artículos.');
  const key=String(id);
  const set=new Set(state.favorites);
  const added=!set.has(key);
  added?set.add(key):set.delete(key);
  await patchMetadata({rt_favorites:[...set].slice(0,MAX_IDS)});
  return added;
}

export async function markRead(id){
  const state=await getLibraryState();
  if(!state.signedIn) return false;
  const set=new Set(state.read);set.add(String(id));
  await patchMetadata({rt_read:[...set].slice(-MAX_IDS)});
  return true;
}

export async function touchLastVisit(){
  const state=await getLibraryState();
  if(!state.signedIn) return null;
  const now=new Date().toISOString();
  await patchMetadata({rt_last_visit:now});
  return now;
}
