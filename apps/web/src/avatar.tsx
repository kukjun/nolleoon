import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {defaultAvatar,requestRoomAvatars,type AvatarProfile} from './api/avatar-client';
import {avatarArtwork,presetLabel} from './avatar-presets';
import './avatar.css';
export function Avatar({avatar=defaultAvatar,label='',size='normal'}:{avatar?:AvatarProfile;label?:string;size?:'small'|'normal'|'large'}){
 const [failed,setFailed]=useState(false);const src=avatar.kind==='image'?avatar.imageUrl:avatarArtwork[avatar.presetId??'preset-01'];
 useEffect(()=>setFailed(false),[src,avatar.revision]);
 return <span className={`avatar avatar--${size}`} role={label?'img':undefined} aria-label={label||undefined} aria-hidden={label?undefined:true}>{src&&!failed?<img src={src} alt="" onError={()=>setFailed(true)} width="64" height="64"/>:<span className="avatar-fallback">{presetLabel(avatar.presetId).slice(0,1)}</span>}</span>;
}
const AvatarContext=createContext<Record<string,AvatarProfile>>({});
export function AvatarProvider({code,children}:{code:string;children:ReactNode}){
 const [members,setMembers]=useState<{code:string;avatars:Record<string,AvatarProfile>}>({code,avatars:{}});const generation=useRef(0);
 useEffect(()=>{
  const ticket=++generation.current;let timer:ReturnType<typeof setTimeout>|undefined;let request:AbortController|undefined;
  async function refresh(){
   clearTimeout(timer);request?.abort();if(document.visibilityState==='hidden')return;
   const next=new AbortController();request=next;const timeout=setTimeout(()=>next.abort(),6000);
   try{const result=await requestRoomAvatars(code,next.signal);if(ticket!==generation.current||request!==next)return;if(result.ok)setMembers({code,avatars:Object.fromEntries(result.data.members.map(m=>[m.memberId,m.avatar]))});else if(result.code==='FORBIDDEN'||result.code==='SESSION_REQUIRED')setMembers({code,avatars:{}});}
   finally{clearTimeout(timeout);if(ticket===generation.current&&request===next)timer=setTimeout(()=>void refresh(),5000);}
  }
  void refresh();document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);window.addEventListener('avatar-updated',refresh);
  return()=>{generation.current++;clearTimeout(timer);request?.abort();document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('avatar-updated',refresh);};
 },[code]);
 return <AvatarContext.Provider value={members.code===code?members.avatars:{}}>{children}</AvatarContext.Provider>;
}
export function MemberAvatar({memberId,nickname,size='normal'}:{memberId:string;nickname:string;size?:'small'|'normal'|'large'}){
 const avatars=useContext(AvatarContext);return <Avatar avatar={avatars[memberId]} label={`${nickname} 아바타`} size={size}/>;
}
