export type PartyGameType = 'trial' | 'team' | 'draw';
export interface PartySelection {type:PartyGameType;version:number;teamCount:number;winnerCount:number;penaltyText:string}
export interface PartyParticipant {memberId:string;nickname:string;eligible:boolean}
export type PartyResult = {kind:'trial';legacyGameId:string} | {kind:'team';assignments:{memberId:string;team:number}[]} | {kind:'draw';revealed:{memberId:string;winner:boolean}[]};
export interface PartyRun {runId:string;type:PartyGameType;status:'active'|'completed'|'interrupted';version:number;participants:PartyParticipant[];self:{eligible:boolean;revealed:boolean};settings:{teamCount:number;winnerCount:number;penaltyText:string};result:PartyResult|null;blockedPolicy:null|'unrevealed-member-left'}
export interface PartySnapshot {roomId:string;inviteCode:string;version:number;selection:PartySelection;run:PartyRun|null;self:{memberId:string;isHost:boolean};blockedPolicy:null|'unrevealed-member-left'}
export interface PartyReceipt {action:'start'|'next'|'reveal';runId:string;requestId:string}
export interface PartyCommandResponse {snapshot:PartySnapshot;receipt:PartyReceipt}
export interface PartyHistory {items:{runId:string;roomCode:string;type:PartyGameType;status:PartyRun['status']}[];nextCursor:string|null}
