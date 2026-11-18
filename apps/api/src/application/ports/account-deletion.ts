import type {TravelRun} from './travel.js';
export interface AccountRoomDeletion {roomId:string;deletedAt:number;purgeAfter:number;deletionVersion:number;previousStatus:'open'|'closed';administratorAccountId:string}
export interface AccountDeletionEntry {roomDeletions?:AccountRoomDeletion[];operationId:string;accountId:string;runIds:string[];legacyRunIds:string[];legacyProofs:{runId:string;sessionId:string}[];createdAt:number}
/** Must durably append and fsync before returning; no configured ledger means no deletion. */
export interface DeletionLedger {record(entry:AccountDeletionEntry):AccountDeletionEntry;entries():readonly AccountDeletionEntry[]}
export interface RedactedRunSummary {participantCount:number;rounds?:{number:number;guilty:number;notGuilty:number;abstain:number;total:number}[];teams?:{team:number;count:number}[];revealed?:{winnerCount:number;notWinnerCount:number};responseCount?:number}
export interface AccountDeletionRepository {
 deletion(accountId:string):{operationId:string;createdAt:number}|undefined;
 kakaoSubject(accountId:string):string|undefined;
 blocked(accountId:string):boolean;
 soloRooms(accountId:string):{id:string;version:number;status:'open'|'closed'}[];
 affectedRuns(accountId:string):TravelRun[];
 linkedRuns(accountId:string):string[];
 legacyProofs(accountId:string):{runId:string;sessionId:string}[];
 nativeRetry(sessionHash:string,now:number):{accountId:string;operationId:string}|undefined;
 retry(sessionHash:string,now:number):{accountId:string;operationId:string}|undefined;
 summary(runId:string):RedactedRunSummary|undefined;
 legacySummary(runId:string):RedactedRunSummary|undefined;
 redactRun(runId:string,summary:RedactedRunSummary):void;
 redactLegacy(entry:AccountDeletionEntry,allowActiveForRestore?:boolean):void;
 scrubIdentity(entry:AccountDeletionEntry):void;
}
