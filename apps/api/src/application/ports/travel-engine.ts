export type TravelGameType='trial'|'team'|'draw'|'menu';
export type TravelRunStatus='draft'|'active'|'completed'|'incomplete'|'interrupted';
export interface TravelGameContext {
 runId:string;now:number;version:number;status:TravelRunStatus;
 actorMembershipId:string;creatorMembershipId:string;facilitatorMembershipId:string;
 participantIds:string[];connectedParticipantIds:string[];
 presence:{membershipId:string;lastSeenAt:number|null;disconnectedAt:number|null;current:boolean}[];
}
export interface TravelTransition {status:TravelRunStatus;state:unknown;result?:unknown|null}
export interface TravelGameEngine {
 readonly type:TravelGameType;
 maintain?(settings:unknown,state:unknown,context:TravelGameContext):TravelTransition|null;
 prepare(settings:unknown,context:TravelGameContext):{settings:unknown;state:unknown};
 start(settings:unknown,state:unknown,context:TravelGameContext):TravelTransition;
 action(settings:unknown,state:unknown,command:unknown,context:TravelGameContext):TravelTransition;
 project(settings:unknown,state:unknown,result:unknown|null,context:TravelGameContext):unknown;
}
