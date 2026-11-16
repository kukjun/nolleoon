import {PresenceMonitor} from '../infrastructure/sessions/presence-monitor.js';
import {Rooms} from '../application/rooms.js';
import {RoomsController} from '../presentation/rooms.controller.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiErrorFilter } from '../presentation/errors.js';
import { GetHealth } from '../application/get-health.js';
import { BrowserSessions, type Clock } from '../application/browser-sessions.js';
import { HealthController } from '../presentation/health.controller.js';
import { SessionController, PUBLIC_ORIGIN } from '../presentation/session.controller.js';
import { openSqlite, migrate, SqliteUnitOfWork } from '../infrastructure/sqlite/index.js';
import { SecureTokens, SystemClock } from '../infrastructure/sessions/secure-tokens.js';
const STORAGE = Symbol('STORAGE');
class StorageResources {
  readonly db;
  readonly uow;
  constructor(path: string) {
    this.db=openSqlite(path);
    try {migrate(this.db);this.uow=new SqliteUnitOfWork(this.db);} catch(error) {this.db.close();throw error;}
  }
  onModuleDestroy() { if(this.db.open) this.db.close(); }
}
export interface AppConfiguration { dbPath: string; publicOrigin: string; clock?: Clock; presenceMonitor?: boolean }
@Module({})
export class AppModule {
  static register(config: AppConfiguration): DynamicModule {
    return {module:AppModule,controllers:[HealthController,SessionController,RoomsController],providers:[
      {provide:APP_FILTER,useClass:ApiErrorFilter},
      {provide:GetHealth,useFactory:()=>new GetHealth()},
      {provide:PUBLIC_ORIGIN,useValue:config.publicOrigin},
      {provide:STORAGE,useFactory:()=>new StorageResources(config.dbPath)},
      {provide:PresenceMonitor,inject:[Rooms],useFactory:(rooms:Rooms)=>new PresenceMonitor(rooms,config.presenceMonitor??true)},
      {provide:Rooms,inject:[STORAGE],useFactory:(resources:StorageResources)=>new Rooms(resources.uow,config.clock??new SystemClock(),new SecureTokens())},
      {provide:BrowserSessions,inject:[STORAGE],useFactory:(resources:StorageResources)=>new BrowserSessions(resources.uow,config.clock??new SystemClock(),new SecureTokens())}
    ]};
  }
}
