import {errorCodes,errorMessages,type ErrorCode,type RoomSnapshot} from '@trip-court/contracts';
export type RoomResult={ok:true;data:RoomSnapshot}|{ok:false;code:ErrorCode|'NETWORK_ERROR'|'INVALID_RESPONSE';message:string};
function record(x:unknown):x is Record<string,unknown>{return typeof x==='object'&&x!==null&&!Array.isArray(x);}
function keys(x:Record<string,unknown>,expected:string[]){return Object.keys(x).sort().join(',')===expected.sort().join(',');}
export function isRoomSnapshot(x:unknown):x is RoomSnapshot {
 if(!record(x)||!keys(x,['roomId','inviteCode','self','members'])||typeof x.roomId!=='string'||typeof x.inviteCode!=='string'||!record(x.self)||!keys(x.self,['memberId','isHost'])||typeof x.self.memberId!=='string'||typeof x.self.isHost!=='boolean'||!Array.isArray(x.members))return false;
 const self=x.self;
 return x.members.length>0&&x.members.every(m=>record(m)&&keys(m,['memberId','nickname','isHost'])&&typeof m.memberId==='string'&&typeof m.nickname==='string'&&typeof m.isHost==='boolean')&&new Set(x.members.map(m=>m.memberId)).size===x.members.length&&x.members.filter(m=>m.isHost).length===1&&x.members.some(m=>m.memberId===self.memberId&&m.isHost===self.isHost);
}
export async function requestRoom(code:string|null,nickname?:string,signal?:AbortSignal):Promise<RoomResult>{
 const path=code===null?'/api/rooms':`/api/rooms/${encodeURIComponent(code)}${nickname===undefined?'':'/join'}`;
 try{
  const response=await fetch(path,{method:nickname===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal,...(nickname===undefined?{}:{headers:{'Content-Type':'application/json','X-Trip-Court-Request':'1'},body:JSON.stringify({nickname})})});
  const data:unknown=await response.json();if(response.ok&&isRoomSnapshot(data))return {ok:true,data};
  if(!response.ok&&record(data)&&record(data.error)&&typeof data.error.code==='string'&&(errorCodes as readonly string[]).includes(data.error.code)){const code=data.error.code as ErrorCode;return {ok:false,code,message:errorMessages[code]};}
  return {ok:false,code:'INVALID_RESPONSE',message:'서버 응답을 확인하지 못했어요. 다시 시도해 주세요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'서버에 연결하지 못했어요. 다시 시도해 주세요.'};}
}
