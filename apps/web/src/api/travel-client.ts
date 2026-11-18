export type TravelResult<T>={ok:true;data:T}|{ok:false;code:string;message:string};
export type AccountSession={authenticated:false}|{authenticated:true;account:{id:string;displayName:string;presetId:string;revision:number}};
export const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(x:unknown):x is string=>typeof x==='string'&&x.length>0;
export function safeReturnTo(path:string){return path==='/travel'||/^\/travel\/invite\/[A-Za-z0-9_-]{20,128}$/.test(path)?path:'/travel';}
export function validAuthorizationUrl(value:unknown):value is string{
 if(typeof value!=='string')return false;
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='kauth.kakao.com'&&url.port===''&&url.pathname==='/oauth/authorize'&&!url.username&&!url.password&&!url.hash;}catch{return false;}
}
const messages:Record<string,string>={ACCOUNT_REQUIRED:'로그인이 만료됐어요. 다시 로그인해 주세요.',SESSION_REQUIRED:'로그인이 만료됐어요. 다시 로그인해 주세요.',STATE_CONFLICT:'다른 변경이 먼저 반영됐거나 현재 상태에서 할 수 없는 동작이에요. 최신 상태를 확인해 주세요.',FORBIDDEN:'이 여행방에 접근할 수 없어요.',NOT_FOUND:'대상을 찾을 수 없어요.',INVITE_INVALID:'사용할 수 없는 초대 링크예요. 새 링크를 요청해 주세요.',ROOM_CLOSED:'종료된 여행방은 읽기 전용이에요.',VERSION_CONFLICT:'다른 변경이 먼저 반영됐어요. 최신 상태를 확인해 주세요.',TEMPORARILY_UNAVAILABLE:'지금은 로그인에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'};
export async function travelRequest<T>(path:string,valid:(x:unknown)=>x is T,options:{body?:unknown;method?:string;signal?:AbortSignal}={},fetcher:typeof fetch=fetch):Promise<TravelResult<T>>{
 const controller=new AbortController();const cancel=()=>controller.abort();options.signal?.addEventListener('abort',cancel,{once:true});if(options.signal?.aborted)controller.abort();const timeout=setTimeout(cancel,6000);
 try{
 const res=await fetcher(path,{method:options.method??(options.body===undefined?'GET':'POST'),credentials:'same-origin',cache:'no-store',signal:controller.signal,...(options.body===undefined?{}:{headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:JSON.stringify(options.body)})});
 const data:unknown=await res.json();
 if(res.ok&&valid(data))return {ok:true,data};
 if(!res.ok){const code=record(data)&&record(data.error)&&text(data.error.code)?data.error.code:res.status===401?'ACCOUNT_REQUIRED':'REQUEST_FAILED';return {ok:false,code,message:messages[code]??'요청을 완료하지 못했어요. 최신 상태를 확인하고 다시 시도해 주세요.'};}
 return {ok:false,code:'INVALID_RESPONSE',message:'응답을 확인하지 못했어요. 다시 시도해 주세요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'연결이 지연되고 있어요. 다시 시도해 주세요.'};}finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',cancel);}
}
export function accountSession(signal?:AbortSignal,fetcher:typeof fetch=fetch){return travelRequest('/api/account/session',(x):x is AccountSession=>record(x)&&(x.authenticated===false||(x.authenticated===true&&validAccount(x.account))),{signal},fetcher);}
export function beginLogin(returnTo:string,signal?:AbortSignal,fetcher:typeof fetch=fetch){return travelRequest('/api/account/login',(x):x is {authorizationUrl:string}=>record(x)&&validAuthorizationUrl(x.authorizationUrl),{body:{returnTo:safeReturnTo(returnTo)},signal},fetcher);}
export function logoutAccount(signal?:AbortSignal){return travelRequest('/api/account/logout',(x):x is {authenticated:false}=>record(x)&&x.authenticated===false,{body:{},signal});}

export function validAccount(x:unknown):x is {id:string;displayName:string;presetId:string;revision:number}{return record(x)&&text(x.id)&&typeof x.displayName==='string'&&typeof x.presetId==='string'&&/^preset-(0[1-9]|10)$/.test(x.presetId)&&Number.isSafeInteger(x.revision)&&Number(x.revision)>=0;}
export function saveAccountProfile(body:{expectedRevision:number;displayName:string;presetId:string},signal?:AbortSignal){return travelRequest('/api/account/profile',(x):x is AccountSession&{authenticated:true}=>record(x)&&x.authenticated===true&&validAccount(x.account),{body,signal});}
