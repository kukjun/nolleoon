import { errorCodes, errorMessages, type ErrorCode, type SessionSnapshot } from '@trip-court/contracts';
export type SessionResult={ok:true;data:SessionSnapshot}|{ok:false;code:ErrorCode|'NETWORK_ERROR'|'INVALID_RESPONSE';message:string};
function isRecord(value:unknown):value is Record<string,unknown> {return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export async function requestSession(method:'GET'|'POST'|'RENEW',fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<SessionResult> {
 let response:Response;
 try {response=await fetcher(method==='RENEW'?'/api/session/renew':'/api/session',{method:method==='GET'?'GET':'POST',signal,credentials:'same-origin',cache:'no-store',...(method!=='GET'?{headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:'{}'}:{})});}
 catch {return {ok:false,code:'NETWORK_ERROR',message:'서버에 연결하지 못했어요. 다시 시도해 주세요.'};}
 let payload:unknown;
 try {payload=await response.json();}catch{return {ok:false,code:'INVALID_RESPONSE',message:'서버 응답을 확인하지 못했어요. 다시 시도해 주세요.'};}
 if(response.ok && isRecord(payload) && Object.keys(payload).length===1 && payload.authenticated===true)return {ok:true,data:{authenticated:true}};
 if(!response.ok && isRecord(payload) && isRecord(payload.error) && typeof payload.error.code==='string' && (errorCodes as readonly string[]).includes(payload.error.code)) {
  const code=payload.error.code as ErrorCode;
  return {ok:false,code,message:errorMessages[code]};
 }
 return {ok:false,code:'INVALID_RESPONSE',message:'서버 응답을 확인하지 못했어요. 다시 시도해 주세요.'};
}
