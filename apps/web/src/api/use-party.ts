import {useCallback,useEffect,useRef,useState} from 'react';
import type {PartySnapshot} from '@trip-court/contracts';
import {requestParty,type PartyCommand,type PartyResponse} from './party-client';
export function useParty(code:string,enabled=true){
 const [snapshot,setSnapshot]=useState<PartySnapshot|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const generation=useRef(0);const locked=useRef(false);const refreshNow=useRef<()=>Promise<void>>(async()=>{});const commandAbort=useRef<AbortController|null>(null);
 const accept=useCallback((next:PartySnapshot)=>setSnapshot(old=>!old||old.roomId!==next.roomId||next.version>=old.version?next:old),[]);
 useEffect(()=>{const ticket=++generation.current;let request:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined;setSnapshot(null);setLoading(enabled);setError('');
  async function refresh(){clearTimeout(timer);request?.abort();if(!enabled||document.visibilityState==='hidden')return;const abort=new AbortController();request=abort;const timeout=setTimeout(()=>abort.abort(),6000);try{const result=await requestParty(code,undefined,abort.signal);if(ticket!==generation.current||request!==abort)return;if(result.ok){accept(result.data);setError('');}else setError(result.message);setLoading(false);}finally{clearTimeout(timeout);if(ticket===generation.current&&request===abort)timer=setTimeout(()=>void refresh(),3000);}}
  refreshNow.current=refresh;void refresh();document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);
  return()=>{generation.current++;request?.abort();commandAbort.current?.abort();clearTimeout(timer);refreshNow.current=async()=>{};document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);};
 },[code,enabled,accept]);
 async function send(command:PartyCommand):Promise<PartyResponse|undefined>{if(locked.current||!enabled)return;locked.current=true;setBusy(true);setError('');const ticket=generation.current;const abort=new AbortController();commandAbort.current=abort;const timeout=setTimeout(()=>abort.abort(),6000);try{const result=await requestParty(code,command,abort.signal);if(ticket!==generation.current)return;if(result.ok)accept(result.data);else setError(result.message);return result;}finally{clearTimeout(timeout);locked.current=false;if(ticket===generation.current)setBusy(false);}}
 return {snapshot,error,loading,busy,send,refresh:()=>refreshNow.current()};
}
