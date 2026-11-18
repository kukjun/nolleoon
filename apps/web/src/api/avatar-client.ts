import {errorCodes,errorMessages,type ErrorCode} from '@trip-court/contracts';
import {identityLoss} from './identity-generation.ts';
export interface AvatarProfile {kind:'preset'|'image';presetId:string|null;revision:number;imageUrl:string|null}
export const defaultAvatar:AvatarProfile={kind:'preset',presetId:'preset-01',revision:0,imageUrl:null};
export type AvatarResult<T>={ok:true;data:T}|{ok:false;code:ErrorCode|'NETWORK_ERROR'|'INVALID_RESPONSE';message:string};
function record(x:unknown):x is Record<string,unknown>{return !!x&&typeof x==='object'&&!Array.isArray(x);}
export function validAvatar(x:unknown):x is AvatarProfile {
 if(!record(x)||Object.keys(x).sort().join(',')!=='imageUrl,kind,presetId,revision'||!Number.isSafeInteger(x.revision)||Number(x.revision)<0)return false;
 return x.kind==='preset'?typeof x.presetId==='string'&&/^preset-(0[1-9]|10)$/.test(x.presetId)&&x.imageUrl===null:
 x.kind==='image'&&x.presetId===null&&typeof x.imageUrl==='string'&&/^\/api\/(?:(?:account\/)?avatar\/image|(?:travel-rooms|rooms)\/[A-Za-z0-9_-]+\/avatars\/[A-Za-z0-9_-]+\/image)(?:\?(?:revision|v)=[0-9]+)?$/.test(x.imageUrl);
}
export function validateAvatarFile(file:{type:string;size:number}){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))return 'PNG, JPG, WebP 사진만 사용할 수 있어요.';
 if(file.size<1||file.size>1048576)return '사진은 1MB 이하로 골라 주세요.';
 return '';
}
async function response<T>(path:string,init:RequestInit,valid:(x:unknown)=>x is T,fetcher:typeof fetch):Promise<AvatarResult<T>>{
 const lost=identityLoss.capture();
 try{
  const res=await fetcher(path,{credentials:'same-origin',cache:'no-store',...init});const body:unknown=await res.json();
  if(res.ok&&valid(body))return {ok:true,data:body};
  if(!res.ok&&record(body)&&record(body.error)&&typeof body.error.code==='string'&&(errorCodes as readonly string[]).includes(body.error.code)){
   const code=body.error.code as ErrorCode;if(code==='SESSION_REQUIRED'&&!path.startsWith('/api/account/')&&!path.startsWith('/api/travel-rooms/'))lost();return {ok:false,code,message:errorMessages[code]};
  }
  return {ok:false,code:'INVALID_RESPONSE',message:'아바타 응답을 확인하지 못했어요. 다시 시도해 주세요.'};
 }catch{return {ok:false,code:'NETWORK_ERROR',message:'아바타를 불러오지 못했어요. 다시 시도해 주세요.'};}
}
export function requestAvatar(path:string,body?:{presetId:string;expectedRevision:number}|{file:File;expectedRevision:number},signal?:AbortSignal,fetcher:typeof fetch=fetch){
 const init:RequestInit={method:body?'PUT':'GET',signal};
 if(body){init.headers={'X-Trip-Court-Request':'1',...('file'in body?{'Content-Type':body.file.type,'X-Avatar-Revision':String(body.expectedRevision)}:{'Content-Type':'application/json'})};init.body='file'in body?body.file:JSON.stringify(body);}
 return response(path,init,validAvatar,fetcher);
}
export interface RoomAvatars {members:{memberId:string;avatar:AvatarProfile}[]}
export function requestRoomAvatars(code:string,signal?:AbortSignal){
 return response(`/api/rooms/${encodeURIComponent(code)}/avatars`,{signal},(x):x is RoomAvatars=>record(x)&&Object.keys(x).length===1&&Array.isArray(x.members)&&x.members.every(m=>record(m)&&Object.keys(m).sort().join(',')==='avatar,memberId'&&typeof m.memberId==='string'&&validAvatar(m.avatar)),fetch);
}
