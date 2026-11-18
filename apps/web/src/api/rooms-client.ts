import {validRedactedGame} from './travel-redacted.ts';
import {identityLoss} from './identity-generation.ts';
import {errorCodes,errorMessages,type ErrorCode,type RoomSnapshot} from '@trip-court/contracts';
export type RoomResult={ok:true;data:RoomSnapshot}|{ok:false;code:ErrorCode|'NETWORK_ERROR'|'INVALID_RESPONSE';message:string};
function record(x:unknown):x is Record<string,unknown>{return typeof x==='object'&&x!==null&&!Array.isArray(x);}
function keys(x:Record<string,unknown>,expected:string[]){return Object.keys(x).sort().join(',')===expected.sort().join(',');}
function isRound(value:unknown):boolean {
 if(value===null)return true;
 return record(value)
  &&keys(value,['number','startedAt','deadline'])
  &&(value.number===1||value.number===2)
  &&typeof value.startedAt==='number'&&Number.isFinite(value.startedAt)
  &&typeof value.deadline==='number'&&Number.isFinite(value.deadline)
  &&value.deadline>value.startedAt;
}
function isDefense(value:unknown):boolean {
 return record(value)
  &&keys(value,['roundNumber','status','text'])
  &&(value.roundNumber===1||value.roundNumber===2)
  &&typeof value.status==='string'
  &&['pending','submitted','skipped'].includes(value.status)
  &&(value.text===null||typeof value.text==='string');
}
function isOwnVote(value:unknown):boolean {
 return value===null||(record(value)
  &&keys(value,['roundNumber','choice','reason'])
  &&(value.roundNumber===1||value.roundNumber===2)
  &&typeof value.choice==='string'&&['guilty','not-guilty','abstain'].includes(value.choice)
  &&typeof value.reason==='string');
}
function isSettlement(value:unknown):boolean {
 if(value===null)return true;
 if(!record(value)||!keys(value,[
  'roundNumber','outcome','guilty','notGuilty','abstain','total','closedAt','closedBy'
 ]))return false;
 if(!(value.roundNumber===1||value.roundNumber===2)||typeof value.outcome!=='string'
  ||!['guilty','not-guilty','no-verdict','tie'].includes(value.outcome)
  ||!(value.closedBy==='all-submitted'||value.closedBy==='deadline')
  ||typeof value.closedAt!=='number'||!Number.isFinite(value.closedAt))return false;
 if(['guilty','notGuilty','abstain','total'].some(key=>!Number.isSafeInteger(value[key])||Number(value[key])<0))return false;
 return Number(value.guilty)+Number(value.notGuilty)+Number(value.abstain)===value.total;
}
function isPublishedRounds(value:unknown):boolean {
 if(!Array.isArray(value)||value.length>2)return false;
 const seen=new Set<number>();
 return value.every(round=>{
  if(!record(round)||!keys(round,['number','counts','reasons'])
   ||!(round.number===1||round.number===2)||seen.has(round.number)
   ||!record(round.counts)||!keys(round.counts,['guilty','notGuilty','abstain'])
   ||['guilty','notGuilty','abstain'].some(key=>!Number.isSafeInteger((round.counts as Record<string,unknown>)[key])||Number((round.counts as Record<string,unknown>)[key])<0)
   ||!Array.isArray(round.reasons))return false;
  seen.add(round.number);
  return round.reasons.every(reason=>record(reason)&&keys(reason,['choice','reason'])
   &&typeof reason.choice==='string'&&['guilty','not-guilty','abstain'].includes(reason.choice)
   &&typeof reason.reason==='string');
 });
}
export function isGameSnapshot(value:unknown):boolean {
 if(!record(value)||!keys(value,[
  'gameId','status','caseText','penaltyText','durationMinutes','self',
  'participantCount','voterCount','version','serverNow','round','defense','ownVote','settlement','publishedRounds'
 ]))return false;
 if(typeof value.gameId!=='string'||typeof value.status!=='string'
  ||!['defense','voting','final-defense','result','interrupted'].includes(value.status)
  ||typeof value.caseText!=='string'||typeof value.penaltyText!=='string')return false;
 if(!Number.isInteger(value.durationMinutes)||Number(value.durationMinutes)<1||Number(value.durationMinutes)>10
  ||!Number.isSafeInteger(value.participantCount)||Number(value.participantCount)<0
  ||!Number.isSafeInteger(value.voterCount)||Number(value.voterCount)<0
  ||!Number.isSafeInteger(value.version)||Number(value.version)<0
  ||typeof value.serverNow!=='number'||!Number.isFinite(value.serverNow))return false;
 const self=value.self;
 if(!record(self)||!keys(self,['role','eligible'])||typeof self.role!=='string'
  ||!['defendant','participant','observer'].includes(self.role)
  ||typeof self.eligible!=='boolean'||self.role!=='participant'&&self.eligible)return false;
 return isRound(value.round)&&isDefense(value.defense)&&isOwnVote(value.ownVote)&&isSettlement(value.settlement)&&isPublishedRounds(value.publishedRounds);
}
export function isRoomSnapshot(x:unknown):x is RoomSnapshot {
 if(record(x)&&Object.hasOwn(x,'redacted')){const {redacted,...raw}=x;if(!validRedactedGame(redacted)||redacted.kind!=='trial'||raw.game!==null||!Array.isArray(raw.members)||raw.members.length!==0||!record(raw.draft)||raw.draft.caseText!==''||raw.draft.penaltyText!==''||!record(raw.self)||raw.interruption!==null||!record(raw.consent)||raw.consent.defendantMemberId!==null||raw.consent.canDecide!==false)return false;return isRoomSnapshot({...raw,members:raw.closed?[]:[{memberId:raw.self.memberId,nickname:'',role:'participant',isHost:raw.self.isHost,connected:true}]});}

 if(!record(x)||!keys(x,['preparationVersion','nextGame','historyGameId','closed','interruption','interrupted','roomId','inviteCode','version','self','members','draft','roleRevision','rosterEditable','consent','start','game'])||typeof x.closed!=='boolean'||typeof x.interrupted!=='boolean'||!Number.isSafeInteger(x.roleRevision)||Number(x.roleRevision)<0||typeof x.rosterEditable!=='boolean'||!Number.isSafeInteger(x.version)||Number(x.version)<0||typeof x.roomId!=='string'||typeof x.inviteCode!=='string'||!record(x.self)||!keys(x.self,['memberId','isHost'])||typeof x.self.memberId!=='string'||typeof x.self.isHost!=='boolean'||!Array.isArray(x.members))return false;
 if(!record(x.draft)||!keys(x.draft,['version','caseText','penaltyText','durationMinutes'])||!Number.isSafeInteger(x.draft.version)||Number(x.draft.version)<0||typeof x.draft.caseText!=='string'||typeof x.draft.penaltyText!=='string'||!Number.isInteger(x.draft.durationMinutes)||Number(x.draft.durationMinutes)<1||Number(x.draft.durationMinutes)>10)return false;
 if(!record(x.start)||!keys(x.start,['canStart','missing'])||typeof x.start.canStart!=='boolean'||!Array.isArray(x.start.missing)||!x.start.missing.every(message=>typeof message==='string'))return false;
 if(x.game!==null&&!isGameSnapshot(x.game))return false;
 if(x.interruption!==null&&(!record(x.interruption)||!keys(x.interruption,['caseText'])||!(x.interruption.caseText===null||typeof x.interruption.caseText==='string')))return false;
 if(!Number.isSafeInteger(x.preparationVersion)||Number(x.preparationVersion)<0||!(x.historyGameId===null||typeof x.historyGameId==='string')||!record(x.nextGame)||!keys(x.nextGame,['canPrepare','fromGameId'])||typeof x.nextGame.canPrepare!=='boolean'||!(x.nextGame.fromGameId===null||typeof x.nextGame.fromGameId==='string'))return false;
 const consent=x.consent;
 if(!record(consent)||!keys(consent,['penaltyRevision','roleRevision','decisionVersion','status','defendantMemberId','canDecide'])||typeof consent.status!=='string'||!['pending','accepted','rejected'].includes(consent.status)||typeof consent.canDecide!=='boolean'||!(consent.defendantMemberId===null||typeof consent.defendantMemberId==='string')||['penaltyRevision','roleRevision','decisionVersion'].some(key=>!Number.isSafeInteger(consent[key])||Number(consent[key])<0))return false;
 const self=x.self;
 if(x.closed)return x.members.length===0&&self.isHost===false;
 return x.members.length>0&&x.members.every(m=>record(m)&&keys(m,['memberId','nickname','isHost','connected','role'])&&typeof m.memberId==='string'&&typeof m.nickname==='string'&&typeof m.isHost==='boolean'&&typeof m.connected==='boolean'&&(m.role==='defendant'||m.role==='participant'))&&new Set(x.members.map(m=>m.memberId)).size===x.members.length&&x.members.filter(m=>m.isHost).length<=1&&x.members.some(m=>m.memberId===self.memberId&&m.isHost===self.isHost);
}
export type RoomCommand={kind:'next-game';requestId:string;fromGameId:string;expectedPreparationVersion:number}|{kind:'close';expectedMemberId:string}|{kind:'role';expectedPreparationVersion:number;role:'defendant'|'participant'}|{kind:'exclude';expectedPreparationVersion:number;memberId:string}|{kind:'consent';penaltyRevision:number;roleRevision:number;expectedDecisionVersion:number;decision:'accepted'|'rejected'}|{kind:'start';requestId:string;expectedDraftVersion:number;expectedRoleRevision:number;expectedDecisionVersion:number}|{kind:'defense';gameId:string;roundNumber:1|2;expectedVersion:number;action:'submit'|'skip';text:string}|{kind:'duration';gameId:string;expectedVersion:number;durationMinutes:number}|{kind:'open-vote';gameId:string;roundNumber:1|2;expectedVersion:number;requestId:string}|{kind:'vote';gameId:string;roundNumber:1|2;requestId:string;choice:'guilty'|'not-guilty'|'abstain';reason:string};
export function verifiedVoteSnapshot(data:unknown,command:Extract<RoomCommand,{kind:'vote'}>):RoomSnapshot|null {
 if(!record(data)||!keys(data,['snapshot','receipt'])||!isRoomSnapshot(data.snapshot)
  ||!record(data.receipt)||!keys(data.receipt,['gameId','roundNumber','choice','reason']))return null;
 const receipt=data.receipt;
 if(receipt.gameId!==command.gameId||receipt.roundNumber!==command.roundNumber
  ||receipt.choice!==command.choice||receipt.reason!==command.reason.trim())return null;
 return data.snapshot;
}
function commandBody(command:RoomCommand){
 switch(command.kind){
 case 'next-game':return {requestId:command.requestId,fromGameId:command.fromGameId,expectedPreparationVersion:command.expectedPreparationVersion};
 case 'close':return {expectedMemberId:command.expectedMemberId};
 case 'role':return {role:command.role,expectedPreparationVersion:command.expectedPreparationVersion};
 case 'exclude':return {memberId:command.memberId,expectedPreparationVersion:command.expectedPreparationVersion};
 case 'consent':return {penaltyRevision:command.penaltyRevision,roleRevision:command.roleRevision,expectedDecisionVersion:command.expectedDecisionVersion,decision:command.decision};
 case 'start':return {requestId:command.requestId,expectedDraftVersion:command.expectedDraftVersion,expectedRoleRevision:command.expectedRoleRevision,expectedDecisionVersion:command.expectedDecisionVersion};
 case 'defense':return {roundNumber:command.roundNumber,expectedVersion:command.expectedVersion,action:command.action,text:command.text};
 case 'duration':return {expectedVersion:command.expectedVersion,durationMinutes:command.durationMinutes};
 case 'vote':return {roundNumber:command.roundNumber,requestId:command.requestId,choice:command.choice,reason:command.reason};
 case 'open-vote':return {roundNumber:command.roundNumber,expectedVersion:command.expectedVersion,requestId:command.requestId};
 }
}
export async function requestRoom(code:string|null,nickname?:string,signal?:AbortSignal,heartbeat=false,settings?:{expectedVersion:number;caseText:string;penaltyText:string;durationMinutes:number},command?:RoomCommand):Promise<RoomResult>{
 const reportIdentityLoss=identityLoss.capture();
 const path=code===null?'/api/rooms':`/api/rooms/${encodeURIComponent(code)}${command?`${'gameId' in command?`/games/${encodeURIComponent(command.gameId)}`:''}/${command.kind}`:settings?'/settings':heartbeat?'/heartbeat':nickname===undefined?'':'/join'}`;
 try{
  const response=await fetch(path,{method:!command&&!settings&&!heartbeat&&nickname===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,...(!command&&!settings&&!heartbeat&&nickname===undefined?{}:{headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:JSON.stringify(command?commandBody(command):settings??(heartbeat?{}:{nickname}))})});
  const data:unknown=await response.json();
  if(signal?.aborted)return {ok:false,code:'NETWORK_ERROR',message:'취소된 요청이에요.'};
  if(response.ok){
   if(command?.kind==='next-game'){const snapshot=verifiedNextGameSnapshot(data,command);if(snapshot)return {ok:true,data:snapshot};}
   else if(command?.kind==='vote'){const snapshot=verifiedVoteSnapshot(data,command);if(snapshot)return {ok:true,data:snapshot};}
   else if(isRoomSnapshot(data))return {ok:true,data};
  }
  if(!response.ok&&record(data)&&record(data.error)&&typeof data.error.code==='string'&&(errorCodes as readonly string[]).includes(data.error.code)){const code=data.error.code as ErrorCode;if(code==='SESSION_REQUIRED')reportIdentityLoss();return {ok:false,code,message:errorMessages[code]};}
  return {ok:false,code:'INVALID_RESPONSE',message:'서버 응답을 확인하지 못했어요. 다시 시도해 주세요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'서버에 연결하지 못했어요. 다시 시도해 주세요.'};}
}
export async function requestLeave(code:string,expectedMemberId:string,signal?:AbortSignal):Promise<{ok:true;memberId:string}|Exclude<RoomResult,{ok:true}>>{
 const reportIdentityLoss=identityLoss.capture();
 try{
  const response=await fetch(`/api/rooms/${encodeURIComponent(code)}/leave`,{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:JSON.stringify({expectedMemberId})});
  const data:unknown=await response.json();
  if(signal?.aborted)return {ok:false,code:'NETWORK_ERROR',message:'취소된 요청이에요.'};
  if(response.ok&&record(data)&&keys(data,['left','memberId'])&&data.left===true&&data.memberId===expectedMemberId)return {ok:true,memberId:expectedMemberId};
  if(!response.ok&&record(data)&&record(data.error)&&typeof data.error.code==='string'&&(errorCodes as readonly string[]).includes(data.error.code)){
   const code=data.error.code as ErrorCode;if(code==='SESSION_REQUIRED')reportIdentityLoss();return {ok:false,code,message:errorMessages[code]};
  }
  return {ok:false,code:'INVALID_RESPONSE',message:'나가기 결과를 확인하지 못했어요. 같은 요청을 다시 확인해 주세요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'나가기 결과를 확인하지 못했어요. 연결 후 같은 요청을 다시 확인해 주세요.'};}
}

export function verifiedNextGameSnapshot(data:unknown,command:Extract<RoomCommand,{kind:'next-game'}>):RoomSnapshot|null {
 if(!record(data)||!keys(data,['snapshot','receipt'])||!isRoomSnapshot(data.snapshot)||!record(data.receipt)||!keys(data.receipt,['fromGameId','preparationVersion']))return null;
 return data.receipt.fromGameId===command.fromGameId&&data.receipt.preparationVersion===command.expectedPreparationVersion+1&&data.snapshot.preparationVersion===data.receipt.preparationVersion?data.snapshot:null;
}

export async function requestGameHistory(code:string,gameId:string,signal?:AbortSignal):Promise<{ok:true;data:import('@trip-court/contracts').GameHistoryDetail}|Exclude<RoomResult,{ok:true}>>{
 const reportIdentityLoss=identityLoss.capture();
 try{const response=await fetch(`/api/rooms/${encodeURIComponent(code)}/games/${encodeURIComponent(gameId)}`,{credentials:'same-origin',cache:'no-store',signal});const data:unknown=await response.json();
  if(signal?.aborted)return {ok:false,code:'NETWORK_ERROR',message:'취소된 요청이에요.'};
  if(response.ok&&record(data)&&keys(data,['gameId','game','interrupted','interruption',...(Object.hasOwn(data,'redacted')?['redacted']:[])])&&isCompletedOrInterruptedHistory(data,gameId))return {ok:true,data:data as unknown as import('@trip-court/contracts').GameHistoryDetail};
  if(!response.ok&&record(data)&&record(data.error)&&typeof data.error.code==='string'&&(errorCodes as readonly string[]).includes(data.error.code)){const code=data.error.code as ErrorCode;if(code==='SESSION_REQUIRED')reportIdentityLoss();return {ok:false,code,message:errorMessages[code]};}
  return {ok:false,code:'INVALID_RESPONSE',message:'이전 게임 기록을 확인하지 못했어요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'서버에 연결하지 못했어요. 다시 시도해 주세요.'};}
}

// Outer response identity and terminal phase must agree with the nested record.
export function isCompletedOrInterruptedHistory(value:Record<string,unknown>,gameId:string):boolean {
 if(value.gameId!==gameId||typeof value.interrupted!=='boolean')return false;
 if(Object.hasOwn(value,'redacted'))return validRedactedGame(value.redacted)&&value.redacted.kind==='trial'&&value.game===null&&value.interruption===null;
 if(value.interrupted)return value.game===null&&(value.interruption===null||(record(value.interruption)&&keys(value.interruption,['caseText'])&&(value.interruption.caseText===null||typeof value.interruption.caseText==='string')));
 return value.interruption===null&&record(value.game)&&isGameSnapshot(value.game)&&value.game.gameId===gameId&&value.game.status==='result';
}
