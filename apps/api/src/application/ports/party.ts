export type GameType = 'trial'|'team'|'draw';
export interface SelectionRecord {roomId:string;type:GameType;version:number;teamCount:number;winnerCount:number;penaltyText:string;preparedAfterRunId:string|null}
export interface RunRecord {id:string;roomId:string;type:GameType;status:'active'|'completed'|'interrupted';version:number;settingsJson:string;createdAt:number}
export interface RunParticipant {runId:string;roomId:string;memberId:string;nickname:string;eligible:boolean}
export interface Allocation {runId:string;memberId:string;team:number|null;winning:boolean|null}
export interface PartyRequest {roomId:string;requestId:string;actorSessionId:string;action:'start'|'next'|'reveal';intent:string;runId:string}
export interface PartyRepository {
 selection(roomId:string):SelectionRecord|undefined;saveSelection(record:SelectionRecord):void;
 run(id:string):RunRecord|undefined;latest(roomId:string):RunRecord|undefined;insertRun(record:RunRecord):void;updateRun(id:string,status:RunRecord['status']):void;
 participants(runId:string):RunParticipant[];addParticipant(record:RunParticipant):void;
 allocations(runId:string):Allocation[];addAllocation(record:Allocation):void;
 reveals(runId:string):string[];reveal(runId:string,memberId:string,now:number):void;
 receipt(roomId:string,requestId:string):PartyRequest|undefined;addReceipt(record:PartyRequest):void;
 history(sessionId:string,before:{createdAt:number;id:string}|null,limit:number):RunRecord[];
 resetCourtPreparation(roomId:string):void;
}
