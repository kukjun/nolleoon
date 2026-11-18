import {UnlinkRequirements} from '../infrastructure/deletion/unlink-requirements.js';
import {UnlinkMonitor} from '../infrastructure/sessions/unlink-monitor.js';
import {KakaoUnlinkWorker} from '../application/kakao-unlink-worker.js';
import type {KakaoUnlinkOutbox} from '../application/ports/kakao-unlink-outbox.js';
import type {KakaoUnlink} from '../application/ports/kakao-unlink.js';
import {LedgerRequirements} from '../infrastructure/deletion/ledger-requirements.js';
import type {RoomDeletionLedger} from '../application/ports/room-deletion.js';
import {RoomDeletionMonitor} from '../infrastructure/sessions/room-deletion-monitor.js';
import {TravelRoomDeletion} from '../application/travel-room-deletion.js';
import {AccountDeletion} from '../application/account-deletion.js';
import type {DeletionLedger} from '../application/ports/account-deletion.js';
import {AccountDeletionController} from '../presentation/account-deletion.controller.js';
import {TravelTeamEngine,TravelDrawEngine} from '../application/travel-team-draw-engines.js';
import {TravelTrialEngine} from '../application/travel-trial-engine.js';
import {TravelMenuEngine} from '../application/travel-menu-engine.js';
import {TravelRooms} from '../application/travel-rooms.js';
import {TravelRuns} from '../application/travel-runs.js';
import type {TravelGameEngine} from '../application/ports/travel-engine.js';
import {TravelDeletedRoomsController,TravelRoomsController,TravelInvitesController} from '../presentation/travel.controller.js';
import {AccountAvatars} from '../application/account-avatars.js';
import {AccountAvatarController} from '../presentation/account-avatar.controller.js';
import {LegacyImports} from '../application/legacy-imports.js';
import {LegacyImportsController} from '../presentation/legacy-imports.controller.js';
import {AccountAuth} from '../application/account-auth.js';
import {AccountController} from '../presentation/account.controller.js';
import type {KakaoIdentityProvider} from '../application/ports/account-auth.js';
import {SharpAvatarProcessor} from '../infrastructure/images/avatar-processor.js';
import {Avatars} from '../application/avatars.js';
import {AvatarController} from '../presentation/avatar.controller.js';
import {PartyController} from '../presentation/party.controller.js';
import {PartyGames} from '../application/party-games.js';
import {RequestGuard} from '../presentation/request-guard.js';
import {HistoryController} from '../presentation/history.controller.js';
import {PersonalHistory} from '../application/personal-history.js';
import {NextGame} from '../application/next-game.js';
import type {RandomSource} from '../application/ports/random.js';
import {SettleRounds} from '../application/settle-round.js';
import {SettlementMonitor} from '../infrastructure/sessions/settlement-monitor.js';
import {SubmitVote} from '../application/submit-vote.js';
import {TrialProgress} from '../application/trial-progress.js';
import {StartTrial} from '../application/start-trial.js';
import {PresenceMonitor} from '../infrastructure/sessions/presence-monitor.js';
import {Rooms} from '../application/rooms.js';
import {RoomsController} from '../presentation/rooms.controller.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApiErrorFilter } from '../presentation/errors.js';
import { GetHealth } from '../application/get-health.js';
import { BrowserSessions, type Clock } from '../application/browser-sessions.js';
import { HealthController } from '../presentation/health.controller.js';
import { SessionController, PUBLIC_ORIGIN } from '../presentation/session.controller.js';
import { openSqlite, migrate, SqliteUnitOfWork } from '../infrastructure/sqlite/index.js';
import { SecureTokens, SystemClock, SecureRandom } from '../infrastructure/sessions/secure-tokens.js';
const STORAGE = Symbol('STORAGE');
class StorageResources {
  readonly db;
  readonly uow;
  readonly requirements;
  readonly unlinkRequirements;
  constructor(path: string,account?:DeletionLedger,room?:RoomDeletionLedger,queue?:KakaoUnlinkOutbox,required=false,now=Date.now()) {
    this.db=openSqlite(path);
    try {migrate(this.db);queue?.expire(now);this.unlinkRequirements=new UnlinkRequirements(this.db);this.unlinkRequirements.check(queue,required);this.requirements=new LedgerRequirements(this.db);this.requirements.check(account,room);this.uow=new SqliteUnitOfWork(this.db);} catch(error) {this.db.close();throw error;}
  }
  onModuleDestroy() { if(this.db.open) this.db.close(); }
}
export interface AppConfiguration { kakaoUnlinkOutbox?:KakaoUnlinkOutbox; kakaoUnlinkProvider?:KakaoUnlink; unlinkRequired?:boolean; unlinkMonitor?:boolean; deletionLedger?:DeletionLedger; roomDeletionLedger?:RoomDeletionLedger; roomDeletionMonitor?:boolean; travelEngines?:readonly TravelGameEngine[]; kakaoProvider?:KakaoIdentityProvider; dbPath: string; publicOrigin: string; clock?: Clock; random?: RandomSource; presenceMonitor?: boolean; settlementMonitor?: boolean }
@Module({})
export class AppModule {
  static register(config: AppConfiguration): DynamicModule {
    const random=config.random??new SecureRandom();const imageProcessor=new SharpAvatarProcessor();
    return {module:AppModule,controllers:[AccountDeletionController,AccountAvatarController,LegacyImportsController,TravelDeletedRoomsController,TravelRoomsController,TravelInvitesController,AccountController,PartyController,AvatarController,HistoryController,HealthController,SessionController,RoomsController],providers:[
      {provide:UnlinkMonitor,useFactory:()=>new UnlinkMonitor(config.kakaoUnlinkOutbox&&config.deletionLedger?new KakaoUnlinkWorker(config.kakaoUnlinkOutbox,config.deletionLedger,config.clock??new SystemClock(),config.kakaoUnlinkProvider):undefined,config.unlinkMonitor??true)},
      {provide:RoomDeletionMonitor,inject:[TravelRoomDeletion],useFactory:(deletion:TravelRoomDeletion)=>new RoomDeletionMonitor(deletion,config.roomDeletionMonitor??true)},
      {provide:TravelRoomDeletion,inject:[STORAGE],useFactory:(resources:StorageResources)=>{const deletion=new TravelRoomDeletion(resources.uow,config.clock??new SystemClock(),config.roomDeletionLedger);deletion.reconcile();return deletion;}},
      {provide:AccountDeletion,inject:[STORAGE,TravelRoomDeletion],useFactory:(resources:StorageResources)=>{const deletion=new AccountDeletion(resources.uow,config.clock??new SystemClock(),new SecureTokens(),config.deletionLedger,config.kakaoUnlinkOutbox,config.unlinkRequired);deletion.reconcile();return deletion;}},
      {provide:TravelRooms,inject:[STORAGE],useFactory:(resources:StorageResources)=>new TravelRooms(resources.uow,config.clock??new SystemClock(),new SecureTokens())},
      {provide:TravelRuns,inject:[STORAGE],useFactory:(resources:StorageResources)=>new TravelRuns(resources.uow,config.clock??new SystemClock(),new SecureTokens(),config.travelEngines??[new TravelTeamEngine(random),new TravelDrawEngine(random),new TravelTrialEngine(),new TravelMenuEngine(random)],random)},
      {provide:LegacyImports,inject:[STORAGE,PartyGames,Rooms],useFactory:(resources:StorageResources,party:PartyGames,rooms:Rooms)=>new LegacyImports(resources.uow,config.clock??new SystemClock(),new SecureTokens(),party,rooms)},
      {provide:AccountAuth,inject:[STORAGE,AccountDeletion,TravelRoomDeletion],useFactory:(resources:StorageResources,deletion:AccountDeletion,rooms:TravelRoomDeletion)=>new AccountAuth(resources.uow,config.clock??new SystemClock(),new SecureTokens(),config.kakaoProvider,()=>{resources.unlinkRequirements.check(config.kakaoUnlinkOutbox,config.unlinkRequired);config.kakaoUnlinkOutbox?.expire((config.clock??new SystemClock()).now());resources.requirements.check(config.deletionLedger,config.roomDeletionLedger);rooms.reconcile();deletion.reconcile();},config.kakaoUnlinkOutbox)},
      {provide:PartyGames,inject:[STORAGE],useFactory:(resources:StorageResources)=>new PartyGames(resources.uow,config.clock??new SystemClock(),new SecureTokens(),random)},
      {provide:APP_GUARD,inject:[BrowserSessions,AccountAuth,TravelRoomDeletion,AccountDeletion,STORAGE],useFactory:(sessions:BrowserSessions,accounts:AccountAuth,rooms:TravelRoomDeletion,accountDeletion:AccountDeletion,resources:StorageResources)=>new RequestGuard(sessions,config.clock??new SystemClock(),accounts,()=>{resources.unlinkRequirements.check(config.kakaoUnlinkOutbox,config.unlinkRequired);config.kakaoUnlinkOutbox?.expire((config.clock??new SystemClock()).now());resources.requirements.check(config.deletionLedger,config.roomDeletionLedger);rooms.reconcile();accountDeletion.reconcile();})},
      {provide:AccountAvatars,inject:[STORAGE,AccountDeletion,TravelRoomDeletion],useFactory:(resources:StorageResources,deletion:AccountDeletion,rooms:TravelRoomDeletion)=>new AccountAvatars(resources.uow,imageProcessor,config.clock??new SystemClock(),()=>{resources.unlinkRequirements.check(config.kakaoUnlinkOutbox,config.unlinkRequired);config.kakaoUnlinkOutbox?.expire((config.clock??new SystemClock()).now());resources.requirements.check(config.deletionLedger,config.roomDeletionLedger);rooms.reconcile();deletion.reconcile();})},
      {provide:Avatars,inject:[STORAGE],useFactory:(resources:StorageResources)=>new Avatars(resources.uow,imageProcessor)},
      {provide:APP_FILTER,useClass:ApiErrorFilter},
      {provide:GetHealth,useFactory:()=>new GetHealth()},
      {provide:PUBLIC_ORIGIN,useValue:config.publicOrigin},
      {provide:STORAGE,useFactory:()=>new StorageResources(config.dbPath,config.deletionLedger,config.roomDeletionLedger,config.kakaoUnlinkOutbox,config.unlinkRequired,(config.clock??new SystemClock()).now())},
      {provide:PresenceMonitor,inject:[Rooms],useFactory:(rooms:Rooms)=>new PresenceMonitor(rooms,config.presenceMonitor??true)},
      {provide:SettleRounds,inject:[STORAGE],useFactory:(resources:StorageResources)=>new SettleRounds(resources.uow,config.clock??new SystemClock(),random)},
      {provide:SettlementMonitor,inject:[SettleRounds],useFactory:(rounds:SettleRounds)=>new SettlementMonitor(rounds,config.settlementMonitor??true)},
      {provide:PersonalHistory,inject:[STORAGE,Rooms],useFactory:(resources:StorageResources,rooms:Rooms)=>new PersonalHistory(resources.uow,rooms,config.clock??new SystemClock(),random)},
      {provide:NextGame,inject:[STORAGE],useFactory:(resources:StorageResources)=>new NextGame(resources.uow,config.clock??new SystemClock(),random)},
      {provide:SubmitVote,inject:[STORAGE],useFactory:(resources:StorageResources)=>new SubmitVote(resources.uow,config.clock??new SystemClock(),random)},
      {provide:TrialProgress,inject:[STORAGE],useFactory:(resources:StorageResources)=>new TrialProgress(resources.uow,config.clock??new SystemClock(),random)},
      {provide:StartTrial,inject:[STORAGE],useFactory:(resources:StorageResources)=>new StartTrial(resources.uow,config.clock??new SystemClock(),new SecureTokens(),random)},
      {provide:Rooms,inject:[STORAGE],useFactory:(resources:StorageResources)=>new Rooms(resources.uow,config.clock??new SystemClock(),new SecureTokens(),random)},
      {provide:BrowserSessions,inject:[STORAGE],useFactory:(resources:StorageResources)=>new BrowserSessions(resources.uow,config.clock??new SystemClock(),new SecureTokens())}
    ]};
  }
}
