import {errorCodes,errorMessages,type ErrorCode,type PersonalHistoryPage,type PersonalHistoryDetail} from '@trip-court/contracts';
import {identityLoss} from './identity-generation.ts';
import {isCompletedOrInterruptedHistory} from './rooms-client.ts';
type Failure={ok:false;code:ErrorCode|'NETWORK_ERROR'|'INVALID_RESPONSE';message:string};
type Result<T>={ok:true;data:T}|Failure;
function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,names:string[]){return Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));}
function textOrNull(value:unknown){return value===null||typeof value==='string';}
function isList(value:unknown):value is PersonalHistoryPage{
 if(!record(value)||!keys(value,['items','nextCursor'])||!Array.isArray(value.items)||value.items.length>20||!textOrNull(value.nextCursor))return false;
 return new Set(value.items.map(item=>record(item)?item.gameId:null)).size===value.items.length&&value.items.every(item=>{
  if(!record(item)||!keys(item,['gameId','state','caseText','outcome'])||typeof item.gameId!=='string'||!textOrNull(item.caseText))return false;
  return item.state==='completed'?(item.outcome===null||typeof item.outcome==='string'&&['guilty','not-guilty','no-verdict'].includes(item.outcome)):(item.state==='ongoing'||item.state==='interrupted')&&item.outcome===null;
 });
}
function isDetail(value:unknown,gameId:string):value is PersonalHistoryDetail{
 if(!record(value)||!keys(value,['gameId','game','interrupted','interruption','ongoing',...(Object.hasOwn(value,'redacted')?['redacted']:[])])||value.gameId!==gameId||typeof value.interrupted!=='boolean')return false;
 if(value.ongoing!==null)return !value.interrupted&&value.game===null&&value.interruption===null&&record(value.ongoing)&&keys(value.ongoing,['caseText'])&&typeof value.ongoing.caseText==='string';
 return isCompletedOrInterruptedHistory(value,gameId);
}
async function read<T>(url:string,valid:(value:unknown)=>value is T,signal?:AbortSignal):Promise<Result<T>>{
 const reportLoss=identityLoss.capture();
 try{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal});const data:unknown=await response.json();
  if(signal?.aborted)return {ok:false,code:'NETWORK_ERROR',message:'취소된 요청이에요.'};
  if(response.ok&&valid(data))return {ok:true,data};
  if(!response.ok&&record(data)&&record(data.error)&&typeof data.error.code==='string'&&(errorCodes as readonly string[]).includes(data.error.code)){const code=data.error.code as ErrorCode;if(code==='SESSION_REQUIRED')reportLoss();return {ok:false,code,message:errorMessages[code]};}
  return {ok:false,code:'INVALID_RESPONSE',message:'게임 기록 응답을 확인하지 못했어요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'게임 기록에 연결하지 못했어요. 다시 시도해 주세요.'};}
}
export function requestHistoryList(cursor?:string,signal?:AbortSignal){return read(`/api/history${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`,isList,signal);}
export function requestHistoryDetail(gameId:string,signal?:AbortSignal){return read(`/api/history/${encodeURIComponent(gameId)}`, (value):value is PersonalHistoryDetail=>isDetail(value,gameId),signal);}
