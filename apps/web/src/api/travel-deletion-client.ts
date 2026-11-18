import {record,travelRequest} from './travel-client';
import {validTravelSnapshot,type TravelSnapshot} from './travel-room-client';
export interface DeletedRoom{roomId:string;title:string;deletedAt:number;deletionVersion:number;purgeAfter:number;previousStatus:'open'|'closed'}
const stamp=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=8640000000000000;
const receipt=(x:unknown):x is {roomId:string;deletedAt:number;deletionVersion:number;purgeAfter:number}=>record(x)&&typeof x.roomId==='string'&&/^[A-Za-z0-9_-]+$/.test(x.roomId)&&stamp(x.deletedAt)&&typeof x.deletionVersion==='number'&&Number.isSafeInteger(x.deletionVersion)&&x.deletionVersion>=0&&stamp(x.purgeAfter)&&x.purgeAfter>x.deletedAt;
export const deleteAccount=(requestId:string,signal?:AbortSignal)=>travelRequest('/api/account/delete',(x):x is {deleted:true}=>record(x)&&x.deleted===true,{body:{requestId,confirmation:'계정 탈퇴'},signal});
export const deleteRoom=(room:TravelSnapshot,requestId:string,signal?:AbortSignal)=>travelRequest(`/api/travel-rooms/${room.roomId}/deletion`,receipt,{body:{requestId,expectedVersion:room.version,confirmation:'DELETE_ROOM'},signal});
export const deletedRooms=(signal?:AbortSignal)=>travelRequest('/api/travel-deleted-rooms',(x):x is {items:DeletedRoom[]}=>record(x)&&Array.isArray(x.items)&&x.items.every(i=>record(i)&&typeof i.title==='string'&&(i.previousStatus==='open'||i.previousStatus==='closed')&&receipt(i)),{signal});
export const restoreRoom=(room:DeletedRoom,requestId:string,signal?:AbortSignal)=>travelRequest(`/api/travel-rooms/${room.roomId}/restore`,validTravelSnapshot,{body:{requestId,deletedAt:room.deletedAt,deletionVersion:room.deletionVersion},signal});
