import {AccountDeletion} from './travel-deletion';
import {useEffect,useRef,useState} from 'react';
import {Button,Input} from './design/components';
import {AvatarPicker} from './avatar-picker';
import {accountSession,saveAccountProfile} from './api/travel-client';
export interface TravelAccount{id:string;displayName:string;presetId:string;revision:number}
export function TravelProfile({account,onSaved,onIdentityLost}:{account:TravelAccount;onSaved:(account:TravelAccount)=>void;onIdentityLost:()=>void}){
 const [open,setOpen]=useState(false);const [name,setName]=useState(account.displayName);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 async function save(){setBusy(true);setError('');const ticket=++generation.current;const c=new AbortController();const timer=setTimeout(()=>c.abort(),6000);try{
  const current=await accountSession(c.signal);if(ticket!==generation.current)return;
  if(!current.ok){if(['SESSION_REQUIRED','ACCOUNT_REQUIRED'].includes(current.code))onIdentityLost();else setError(current.message);return;}
  if(!current.data.authenticated||current.data.account.id!==account.id){onIdentityLost();return;}
  // Name-only save uses the server's current preset so an independently updated photograph is not replaced.
  const r=await saveAccountProfile({expectedRevision:current.data.account.revision,displayName:name.trim(),presetId:current.data.account.presetId},c.signal);if(ticket!==generation.current)return;
  if(r.ok){onSaved(r.data.account);setOpen(false);}else if(['SESSION_REQUIRED','ACCOUNT_REQUIRED'].includes(r.code))onIdentityLost();else setError(r.message);
 }finally{clearTimeout(timer);if(ticket===generation.current)setBusy(false);}}
 return <section className="travel-card"><div className="travel-profile-summary"><strong>{account.displayName}</strong><Button variant="quiet" disabled={busy} onPress={()=>{setOpen(!open);setName(account.displayName);setError('');}}>프로필 {open?'접기':'수정'}</Button></div>{open&&<><Input label="여행방에서 사용할 이름" value={name} maxLength={20} onChange={e=>setName(e.target.value)}/>{error&&<p role="alert">{error}</p>}<Button loading={busy} disabled={!name.trim()} onPress={save}>이름 저장</Button><AvatarPicker apiBase="/api/account/avatar" onIdentityLost={onIdentityLost}/><p className="travel-muted">카카오 사진과 이전 브라우저 사진은 자동으로 가져오지 않아요. 내 사진을 직접 선택하면 계정에 저장해요.</p><AccountDeletion onDeleted={onIdentityLost} onIdentityLost={onIdentityLost}/></>}</section>;
}
