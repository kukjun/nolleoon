import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Avatar} from './avatar';
import {defaultAvatar,validAvatar,type AvatarProfile} from './api/avatar-client';
import {record,travelRequest} from './api/travel-client';
const Context=createContext<Record<string,AvatarProfile>>({});
export function TravelAvatars({roomId,closed,children}:{roomId:string;closed:boolean;children:ReactNode}){
 const [cache,setCache]=useState<Record<string,AvatarProfile>>({});const generation=useRef(0);
 useEffect(()=>{const ticket=++generation.current;setCache({});if(closed)return;let terminal=false;let request:AbortController|undefined;
 async function load(){request?.abort();request=new AbortController();const r=await travelRequest(`/api/travel-rooms/${roomId}/avatars`,(x):x is {members:{memberId:string;avatar:AvatarProfile}[]}=>record(x)&&Array.isArray(x.members)&&x.members.every(m=>record(m)&&typeof m.memberId==='string'&&validAvatar(m.avatar)),{signal:request.signal});if(ticket!==generation.current)return;if(r.ok)setCache(Object.fromEntries(r.data.members.map(m=>[m.memberId,m.avatar])));else if(['FORBIDDEN','ROOM_CLOSED','NOT_FOUND','ACCOUNT_REQUIRED','SESSION_REQUIRED'].includes(r.code)){terminal=true;setCache({});}}
 void load();const timer=setInterval(()=>{if(!terminal&&document.visibilityState!=='hidden')void load();},10000);const refresh=()=>{if(!terminal)void load();};window.addEventListener('account-avatar-updated',refresh);
 return()=>{generation.current++;request?.abort();clearInterval(timer);window.removeEventListener('account-avatar-updated',refresh);};},[roomId,closed]);
 return <Context.Provider value={closed?{}:cache}>{children}</Context.Provider>;
}
export function TravelMemberAvatar({memberId,presetId='preset-01'}:{memberId:string;presetId?:string}){const avatars=useContext(Context);return <Avatar avatar={avatars[memberId]??{...defaultAvatar,presetId}}/>;}
