export const UNLINK_RETENTION_MS=7*24*60*60*1000;
export interface UnlinkIntent {operationId:string;subject:string;createdAt:number;expiresAt:number}
export interface UnlinkJob extends UnlinkIntent {attempts:number;nextAttemptAt:number}
/** Authoritative current queue outside application DB/backups. All methods validate current authority.
 * Terminal records contain only operationId/status/timestamp, never subject or its hash. */
export interface KakaoUnlinkOutbox {
 prepare(intent:UnlinkIntent):UnlinkIntent;
 pending(subject:string,now:number):boolean;
 jobs(now:number):UnlinkJob[];
 claim(operationId:string,now:number):UnlinkJob|undefined;
 complete(operationId:string,now:number):void;
 fail(operationId:string,now:number):void;
 expire(now:number):void;
 available():void;
 bindingIdentity?():string;
 witness?():{sequence:number;digest:string};
 verifyPrefix?(witness:{sequence:number;digest:string}):void;
}
