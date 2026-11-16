import type {UnitOfWork,Repositories,GameRecord} from './ports/storage.js';
import type {Clock} from './browser-sessions.js';
import type {RandomSource} from './ports/random.js';
import {maintainBeforeRequest} from './membership-lifecycle.js';
import {DomainFailure} from '../domain/failure.js';
import {Rooms} from './rooms.js';
const PAGE_SIZE=20;
function gameId(value:unknown):string {
 if(typeof value!=='string'||!value||value.length>100||!/^[a-zA-Z0-9_-]+$/.test(value))throw new DomainFailure('INVALID_INPUT');
 return value;
}
function authorized(r:Repositories,sessionId:string,id:string){
 const game=r.games.find(id);if(!game)throw new DomainFailure('NOT_FOUND');
 if(!r.participants.hasSession(id,sessionId))throw new DomainFailure('FORBIDDEN');
 return game;
}
function summary(r:Repositories,game:GameRecord){
 if(game.status==='interrupted')return {gameId:game.id,state:'interrupted' as const,caseText:r.interruptions.find(game.id)?.cause==='room-closed'?game.caseText:null,outcome:null};
 if(game.status!=='result')return {gameId:game.id,state:'ongoing' as const,caseText:game.caseText,outcome:null};
 const settlement=r.settlements.find(game.id,2)??r.settlements.find(game.id,1);
 return {gameId:game.id,state:'completed' as const,caseText:game.caseText,outcome:settlement?.outcome==='tie'?null:settlement?.outcome??null};
}
export class PersonalHistory {
 constructor(private readonly uow:UnitOfWork,private readonly rooms:Rooms,private readonly clock:Clock,private readonly random:RandomSource){}
 list(actor:{id:string},cursor?:unknown){
  const id=cursor===undefined?undefined:gameId(cursor);
  maintainBeforeRequest(this.uow,this.clock.now(),this.random);
  return this.uow.run(r=>{
   const anchor=id?authorized(r,actor.id,id):undefined;
   const records=r.games.history(actor.id,anchor?{createdAt:anchor.createdAt,id:anchor.id}:null,PAGE_SIZE+1);
   const page=records.slice(0,PAGE_SIZE);
   return {items:page.map(game=>summary(r,game)),nextCursor:records.length>PAGE_SIZE?page.at(-1)!.id:null};
  });
 }
 detail(actor:{id:string},value:unknown){
  const id=gameId(value);maintainBeforeRequest(this.uow,this.clock.now(),this.random);
  const context=this.uow.run(r=>{
   const game=authorized(r,actor.id,id);const room=r.rooms.find(game.roomId)!;
   return {game,code:room.inviteCode};
  });
  if(!['result','interrupted'].includes(context.game.status)){
   // 진행 중 목록에서는 읽기 전용 사건/상태만 제공한다. 현재 표·이유·벌칙은 내보내지 않는다.
   return {gameId:id,game:null,interrupted:false,interruption:null,ongoing:{caseText:context.game.caseText}};
  }
  return {...this.rooms.history(actor,context.code,id),ongoing:null};
 }
}
