import type {ConsentRecord} from './ports/storage.js';
import {DomainFailure} from '../domain/failure.js';
export interface ConsentContext {memberId:string|null;roleRevision:number;penaltyRevision:number;penaltyText:string}
export function consentStatus(context:ConsentContext,record?:ConsentRecord):'pending'|'accepted'|'rejected'{
 return context.memberId&&context.penaltyText.trim()&&record&&record.memberId===context.memberId&&record.roleRevision===context.roleRevision&&record.penaltyRevision===context.penaltyRevision?record.decision:'pending';
}
// 시작 유스케이스는 같은 트랜잭션에서 읽은 현재 context/record로 호출한다.
export function hasCurrentAcceptance(context:ConsentContext,record?:ConsentRecord){return consentStatus(context,record)==='accepted';}
export function validateConsent(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new DomainFailure('INVALID_INPUT');const value=input as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=='decision,expectedDecisionVersion,penaltyRevision,roleRevision'||(value.decision!=='accepted'&&value.decision!=='rejected'))throw new DomainFailure('INVALID_INPUT');
 for(const key of ['expectedDecisionVersion','penaltyRevision','roleRevision'])if(!Number.isSafeInteger(value[key])||Number(value[key])<0)throw new DomainFailure('INVALID_INPUT');
 return value as {decision:'accepted'|'rejected';expectedDecisionVersion:number;penaltyRevision:number;roleRevision:number};
}
