export interface LegacyLink {id:string;accountId:string;runId:string;legacySessionId:string;linkedAt:number}
export interface LegacyLinksRepository {
 find(runId:string,sessionId:string):LegacyLink|undefined;
 insert(record:LegacyLink):void;
 byAccount(accountId:string,before:{linkedAt:number;id:string}|null,limit:number):LegacyLink[];
 findOwned(id:string,accountId:string):LegacyLink|undefined;
}
