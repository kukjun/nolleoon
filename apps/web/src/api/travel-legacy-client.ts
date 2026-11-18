import type {PartyRun,PersonalHistoryDetail} from '@trip-court/contracts';
import {isPartyRun} from './party-client.ts';
import {isCompletedOrInterruptedHistory} from './rooms-client.ts';
import {record,travelRequest} from './travel-client.ts';
export interface LegacyItem{id:string;runId:string;type:'trial'|'team'|'draw';status:string;createdAt:number}
export interface LegacyPreview{runId:string;type:'trial'|'team'|'draw';status:string;createdAt:number;linkState:'available'|'linked'|'unavailable'}
export interface LinkedLegacyDetail{id:string;runId:string;party:PartyRun|null;court:PersonalHistoryDetail|null}
const text=(x:unknown):x is string=>typeof x==='string'&&x.length>0;
const base=(x:unknown):x is Record<string,unknown>=>record(x)&&text(x.runId)&&['trial','team','draw'].includes(String(x.type))&&typeof x.status==='string'&&Number.isSafeInteger(x.createdAt)&&Number(x.createdAt)>=0&&Number(x.createdAt)<=8640000000000000;
export function validLegacyPreview(x:unknown):x is {items:LegacyPreview[];nextCursor:string|null}{return record(x)&&Array.isArray(x.items)&&x.items.every(i=>base(i)&&['available','linked','unavailable'].includes(String(i.linkState)))&&(x.nextCursor===null||typeof x.nextCursor==='string');}
export function previewLegacy(cursor:string|null,signal?:AbortSignal){return travelRequest(`/api/account/legacy/preview${cursor?'?cursor='+encodeURIComponent(cursor):''}`,validLegacyPreview,{signal});}
export function listLegacy(cursor:string|null,signal?:AbortSignal){return travelRequest(`/api/account/legacy${cursor?'?cursor='+encodeURIComponent(cursor):''}`,(x):x is {items:LegacyItem[];nextCursor:string|null}=>record(x)&&Array.isArray(x.items)&&x.items.every(i=>base(i)&&text(i.id))&&(x.nextCursor===null||typeof x.nextCursor==='string'),{signal});}
export function importLegacy(runIds:string[],signal?:AbortSignal){return travelRequest('/api/account/legacy/import',(x):x is {items:{id:string;runId:string}[]}=>record(x)&&Array.isArray(x.items)&&x.items.every(i=>record(i)&&text(i.id)&&text(i.runId)&&runIds.includes(i.runId)),{body:{runIds},signal});}
export function validLinkedLegacyDetail(x:unknown):x is LinkedLegacyDetail{
 if(!record(x)||!text(x.id)||!text(x.runId)||(x.party!==null&&!isPartyRun(x.party)))return false;
 if(x.party!==null&&x.party.runId!==x.runId)return false;
 if(x.court===null)return true;
 if(!record(x.court)||x.court.gameId!==x.runId)return false;
 if(x.court.ongoing!==null)return x.court.game===null&&x.court.interrupted===false&&x.court.interruption===null&&record(x.court.ongoing)&&typeof x.court.ongoing.caseText==='string';
 return isCompletedOrInterruptedHistory(x.court,x.runId);
}
export function readLegacy(id:string,signal?:AbortSignal){return travelRequest(`/api/account/legacy/${encodeURIComponent(id)}`,(x):x is LinkedLegacyDetail=>validLinkedLegacyDetail(x)&&x.id===id,{signal});}
