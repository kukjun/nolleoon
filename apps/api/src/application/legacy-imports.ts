import type {UnitOfWork,Repositories} from './ports/storage.js';
import type {Clock,TokenCodec} from './browser-sessions.js';
import {SessionRequired} from './browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';
import {PartyGames,exactBody} from './party-games.js';
import {Rooms} from './rooms.js';
function id(value:unknown):string{if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(value))throw new DomainFailure('INVALID_INPUT');return value;}
export class LegacyImports {
 constructor(private readonly uow:UnitOfWork,private readonly clock:Clock,private readonly codec:TokenCodec,private readonly party:PartyGames,private readonly rooms:Rooms){}
 private account(r:Repositories,accountId:string){if(r.accountAuth.findAccount(accountId)?.status!=='active')throw new SessionRequired();}
 private proof(r:Repositories,token:unknown,now:number){
  if(typeof token!=='string'||!/^[-a-zA-Z0-9_]{43}$/.test(token))throw new SessionRequired();
  const session=r.sessions.findByTokenHash(this.codec.hash(token));if(!session||session.expiresAt<=now)throw new SessionRequired();return session.id;
 }
 private ownedRun(r:Repositories,sessionId:string,runId:string){
  const run=r.party.run(runId);if(!run)throw new DomainFailure('NOT_FOUND');
  if(!r.party.participants(runId).some(p=>r.members.find(p.memberId)?.sessionId===sessionId))throw new DomainFailure('FORBIDDEN');
  return run;
 }
 preview(accountId:string,legacyToken:unknown,cursor?:unknown){
  const anchorId=cursor===undefined?undefined:id(cursor);
  return this.uow.run(r=>{this.account(r,accountId);const sessionId=this.proof(r,legacyToken,this.clock.now());const anchor=anchorId?this.ownedRun(r,sessionId,anchorId):undefined;
   const rows=r.party.history(sessionId,anchor?{createdAt:anchor.createdAt,id:anchor.id}:null,21),page=rows.slice(0,20);
   return {items:page.filter(run=>run.status!=='active').map(run=>{const link=r.legacyLinks.find(run.id,sessionId);return {runId:run.id,type:run.type,status:run.status,linkState:link?(link.accountId===accountId?'linked':'unavailable'):'available'};}),nextCursor:rows.length>20?page.at(-1)!.id:null};
  });
 }
 import(accountId:string,legacyToken:unknown,input:unknown){
  const b=exactBody(input,['runIds']);if(!Array.isArray(b.runIds)||b.runIds.length<1||b.runIds.length>20)throw new DomainFailure('INVALID_INPUT');const ids=b.runIds.map(id);if(new Set(ids).size!==ids.length)throw new DomainFailure('INVALID_INPUT');
  return this.uow.run(r=>{this.account(r,accountId);const now=this.clock.now(),sessionId=this.proof(r,legacyToken,now);
   const records=ids.map(runId=>{const run=this.ownedRun(r,sessionId,runId);if(run.status==='active')throw new DomainFailure('STATE_CONFLICT');const old=r.legacyLinks.find(runId,sessionId);if(old&&old.accountId!==accountId)throw new DomainFailure('STATE_CONFLICT');return {runId,old};});
   return {items:records.map(({runId,old})=>{const link=old??{id:this.codec.id(),accountId,runId,legacySessionId:sessionId,linkedAt:now};if(!old)r.legacyLinks.insert(link);return {id:link.id,runId};})};
  });
 }
 list(accountId:string,cursor?:unknown){
  const anchorId=cursor===undefined?undefined:id(cursor);
  return this.uow.run(r=>{this.account(r,accountId);const anchor=anchorId?r.legacyLinks.findOwned(anchorId,accountId):undefined;if(anchorId&&!anchor)throw new DomainFailure('NOT_FOUND');const rows=r.legacyLinks.byAccount(accountId,anchor?{linkedAt:anchor.linkedAt,id:anchor.id}:null,21),page=rows.slice(0,20);return {items:page.map(link=>{const run=this.ownedRun(r,link.legacySessionId,link.runId);return {id:link.id,runId:run.id,type:run.type,status:run.status};}),nextCursor:rows.length>20?page.at(-1)!.id:null};});
 }
 detail(accountId:string,value:unknown){
  const linkId=id(value);return this.uow.run(r=>{this.account(r,accountId);const link=r.legacyLinks.findOwned(linkId,accountId);if(!link)throw new DomainFailure('NOT_FOUND');const run=this.ownedRun(r,link.legacySessionId,link.runId);if(run.status==='active')throw new DomainFailure('STATE_CONFLICT');const actor={id:link.legacySessionId};
   return {id:link.id,runId:run.id,party:this.party.historyProjection(r,actor,run.id),court:run.type==='trial'?{...this.rooms.historyProjection(r,actor,r.rooms.find(run.roomId)!,run.id,this.clock.now()),ongoing:null}:null};
  });
 }
}
