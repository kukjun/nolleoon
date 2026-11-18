import type {TravelGameType,TravelRunStatus} from './travel-engine.js';
export interface TravelRoom {id:string;title:string;startDate:string|null;endDate:string|null;status:'open'|'closed';version:number;createdAt:number;administratorMembershipId:string|null}
export interface TravelMember {id:string;roomId:string;accountId:string;joinedAt:number;leftAt:number|null;departure:'left'|'removed'|null}
export interface TravelPresence {membershipId:string;lastSeenAt:number;disconnectedAt:number|null}
export interface TravelRun {id:string;roomId:string;type:TravelGameType;status:TravelRunStatus;creatorMembershipId:string;facilitatorMembershipId:string;version:number;settingsJson:string;stateJson:string;resultJson:string|null;selectedMembershipIdsJson:string;createdAt:number;startedAt:number|null;endedAt:number|null;legacyRunId:string|null}
export interface TravelRepository {
 room(id:string):TravelRoom|undefined;insertRoom(r:TravelRoom):void;saveRoom(r:TravelRoom):void;
 list(accountId:string,before:{createdAt:number;id:string}|null,limit:number):TravelRoom[];
 member(id:string):TravelMember|undefined;membership(roomId:string,accountId:string):TravelMember|undefined;members(roomId:string):TravelMember[];insertMember(r:TravelMember):void;depart(id:string,now:number,departure:'left'|'removed'):void;
 presence(id:string):TravelPresence|undefined;touch(id:string,now:number):void;detectDisconnected(roomId:string,now:number,silentMs:number):void;
 invite(hash:string):{roomId:string;revokedAt:number|null}|undefined;revokeInvites(roomId:string,now:number):void;insertInvite(hash:string,roomId:string,now:number):void;
 receipt(accountId:string,requestId:string):{intent:string;resultJson:string}|undefined;insertReceipt(accountId:string,requestId:string,intent:string,resultJson:string,now:number):void;
 run(id:string):TravelRun|undefined;currentRun(roomId:string):TravelRun|undefined;insertRun(r:TravelRun):void;saveRun(r:TravelRun):void;
 participants(runId:string):string[];addParticipant(runId:string,roomId:string,membershipId:string,now:number):void;
 history(roomId:string,before:{createdAt:number;id:string}|null,limit:number):TravelRun[];
}
