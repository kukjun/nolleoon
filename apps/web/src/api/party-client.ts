import {errorCodes,errorMessages,type ErrorCode,type PartySnapshot,type PartyRun,type PartyReceipt,type PartyGameType} from '@trip-court/contracts';
import {identityLoss} from './identity-generation.ts';
export type PartyCommand={kind:'selection';expectedVersion:number;type:PartyGameType;teamCount:number;winnerCount:number;penaltyText:string}|{kind:'start';requestId:string;expectedSelectionVersion:number}|{kind:'next';requestId:string;fromRunId:string;expectedSelectionVersion:number}|{kind:'reveal';runId:string;requestId:string};
export type PartyResponse={ok:true;data:PartySnapshot;receipt:PartyReceipt|null}|{ok:false;code:ErrorCode|'NETWORK_ERROR'|'INVALID_RESPONSE';message:string};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).sort().join(',')===names.sort().join(',');
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0;
const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const kind=(v:unknown)=>v==='trial'||v==='team'||v==='draw';
const policy=(v:unknown)=>v===null||v==='unrevealed-member-left';
export function isPartyRun(v:unknown):v is PartyRun{
 if(!record(v)||!keys(v,['runId','type','status','version','participants','self','settings','result','blockedPolicy'])||!text(v.runId)||!kind(v.type)||!['active','completed','interrupted'].includes(String(v.status))||!count(v.version)||!policy(v.blockedPolicy)||!Array.isArray(v.participants)||!record(v.self)||!keys(v.self,['eligible','revealed'])||typeof v.self.eligible!=='boolean'||typeof v.self.revealed!=='boolean'||!record(v.settings)||!keys(v.settings,['teamCount','winnerCount','penaltyText'])||!count(v.settings.teamCount)||!count(v.settings.winnerCount)||typeof v.settings.penaltyText!=='string')return false;
 const ids=new Set<string>();for(const p of v.participants){if(!record(p)||!keys(p,['memberId','nickname','eligible'])||!text(p.memberId)||typeof p.nickname!=='string'||typeof p.eligible!=='boolean'||ids.has(p.memberId))return false;ids.add(p.memberId);}
 if(v.result===null)return true;
 if(!record(v.result)||v.result.kind!==v.type)return false;
 if(v.result.kind==='trial')return keys(v.result,['kind','legacyGameId'])&&text(v.result.legacyGameId);
 if(!v.self.eligible)return false;
 const field=v.result.kind==='team'?'assignments':'revealed';if(!keys(v.result,['kind',field])||!Array.isArray(v.result[field]))return false;
 const seen=new Set<string>();return (v.result[field] as unknown[]).every(item=>{if(!record(item)||!keys(item,['memberId',field==='assignments'?'team':'winner'])||!text(item.memberId)||!ids.has(item.memberId)||seen.has(item.memberId))return false;seen.add(item.memberId);return field==='assignments'?Number.isSafeInteger(item.team)&&Number(item.team)>=1&&Number(item.team)<=Number((v.settings as Record<string,unknown>).teamCount):typeof item.winner==='boolean';});
}
export function isPartySnapshot(v:unknown):v is PartySnapshot{
 return record(v)&&keys(v,['roomId','inviteCode','version','selection','run','self','blockedPolicy'])&&text(v.roomId)&&text(v.inviteCode)&&count(v.version)&&record(v.selection)&&keys(v.selection,['type','version','teamCount','winnerCount','penaltyText'])&&kind(v.selection.type)&&count(v.selection.version)&&count(v.selection.teamCount)&&count(v.selection.winnerCount)&&typeof v.selection.penaltyText==='string'&&(v.run===null||isPartyRun(v.run))&&record(v.self)&&keys(v.self,['memberId','isHost'])&&text(v.self.memberId)&&typeof v.self.isHost==='boolean'&&policy(v.blockedPolicy);
}
export async function requestParty(code:string,command?:PartyCommand,signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<PartyResponse>{
 const lost=identityLoss.capture();const root=`/api/party/rooms/${encodeURIComponent(code)}`;const path=command?`${root}/${command.kind==='reveal'?`runs/${encodeURIComponent(command.runId)}/reveal`:command.kind}`:root;
 let body:Record<string,unknown>|undefined;if(command){const {kind:action,...fields}=command;body={...fields};if(action==='reveal')delete body.runId;}
 try{const response=await fetcher(path,{method:command?command.kind==='selection'?'PUT':'POST':'GET',credentials:'same-origin',cache:'no-store',signal,...(command?{headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:JSON.stringify(body)}:{})});const data:unknown=await response.json();if(signal?.aborted)return {ok:false,code:'NETWORK_ERROR',message:'취소된 요청이에요.'};
  if(response.ok){if(!command||command.kind==='selection'){if(isPartySnapshot(data))return {ok:true,data,receipt:null};}
   else if(record(data)&&keys(data,['snapshot','receipt'])&&isPartySnapshot(data.snapshot)&&record(data.receipt)&&keys(data.receipt,['action','runId','requestId'])&&data.receipt.action===command.kind&&data.receipt.requestId===command.requestId&&text(data.receipt.runId)&&(command.kind!=='reveal'||data.receipt.runId===command.runId)&&(command.kind!=='next'||data.receipt.runId===command.fromRunId))return {ok:true,data:data.snapshot,receipt:data.receipt as unknown as PartyReceipt};
  }
  if(!response.ok&&record(data)&&record(data.error)&&typeof data.error.code==='string'&&(errorCodes as readonly string[]).includes(data.error.code)){const code=data.error.code as ErrorCode;if(code==='SESSION_REQUIRED')lost();return {ok:false,code,message:errorMessages[code]};}
  return {ok:false,code:'INVALID_RESPONSE',message:'게임 응답을 확인하지 못했어요. 새로 확인해 주세요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'서버에 연결하지 못했어요. 다시 시도해 주세요.'};}
}
