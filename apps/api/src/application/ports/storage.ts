import type {TravelRepository} from './travel.js';
import type {AccountAuthRepository} from './account-auth.js';
import type {PartyRepository} from './party.js';
import type {TallyOutcome} from '../../domain/tally.js';
export interface SessionRecord { id: string; tokenHash: string; createdAt: number; expiresAt: number }
export interface RoomRecord { id: string; inviteCode: string; status: 'open' | 'closed'; version: number; createdAt: number; penaltyRevision?: number; roleRevision?: number; hostMemberId?: string | null; preparationVersion?:number; preparedAfterGameId?:string|null }
export interface MemberRecord { id: string; roomId: string; sessionId: string; nickname: string; nicknameKey: string; joinedAt: number; role?: 'defendant' | 'participant'; lastSeenAt?: number | null; disconnectedAt?: number | null }
export interface GameRecord { id: string; roomId: string; status: 'draft' | 'defense' | 'voting' | 'final-defense' | 'result' | 'interrupted'; caseText: string; penaltyText: string; durationSeconds: number; version: number; createdAt: number }
export interface ParticipantRecord { gameId: string; roomId: string; memberId: string; role: 'defendant' | 'participant' | 'observer'; eligible: boolean }
export interface RoundRecord { gameId: string; number: 1 | 2; startedAt: number; deadline: number; closedAt?: number | null }
export interface VoteRecord { gameId: string; roundNumber: 1 | 2; memberId: string; choice: 'guilty' | 'not-guilty' | 'abstain'; reason: string; requestId: string; submittedAt: number }
export interface DraftRecord { roomId: string; caseText: string; penaltyText: string; durationSeconds: number; version: number }
export interface InsertRepository<T> { insert(record: T): void }
export interface ConsentRecord {roomId:string;memberId:string;roleRevision:number;penaltyRevision:number;decision:'accepted'|'rejected';version:number}
export interface StartReceipt {roomId:string;requestId:string;actorSessionId:string;intent:string;gameId:string}
export interface DefenseRecord {gameId:string;roundNumber:1|2;memberId:string;action:'submitted'|'skipped';text:string}
export interface OpenReceipt {gameId:string;requestId:string;actorSessionId:string;intent:number;roundNumber:1|2}
export interface SettlementRecord {gameId:string;roundNumber:1|2;outcome:TallyOutcome;guilty:number;notGuilty:number;abstain:number;total:number;closedAt:number;closedBy:'all-submitted'|'deadline'}
export interface InterruptionRecord {gameId:string;cause:'defendant-left'|'room-closed'|'legacy-private';interruptedAt:number}
export interface ClosureRecord {roomId:string;closedAt:number;closedByMemberId:string|null}
export interface NextReceipt {roomId:string;requestId:string;actorSessionId:string;fromGameId:string;expectedPreparationVersion:number;preparationVersion:number}
export interface AvatarRecord {sessionId:string;presetId:string|null;revision:number;imageBytes:Uint8Array|null}
export interface Repositories {
  accountAuth:AccountAuthRepository;
  travel:TravelRepository;
  avatars:{find(sessionId:string,includeImage?:boolean):AvatarRecord|undefined;totalImageBytes():number;save(record:AvatarRecord):void};
  party:PartyRepository;
  nextPreparations:InsertRepository<NextReceipt>&{find(roomId:string,requestId:string):NextReceipt|undefined};
  interruptions:InsertRepository<InterruptionRecord>&{find(gameId:string):InterruptionRecord|undefined};
  closures:InsertRepository<ClosureRecord>&{find(roomId:string):ClosureRecord|undefined};
  settlements:InsertRepository<SettlementRecord> & {find(gameId:string,roundNumber:number):SettlementRecord|undefined};
  defenses:{find(gameId:string,roundNumber:number):DefenseRecord|undefined;save(record:DefenseRecord):void};
  opens:{find(gameId:string,requestId:string):OpenReceipt|undefined;insert(record:OpenReceipt):void};
  starts:{find(roomId:string,requestId:string):StartReceipt|undefined;insert(record:StartReceipt):void};
  consents:{find(roomId:string):ConsentRecord|undefined;save(record:ConsentRecord):void};
  sessions: InsertRepository<SessionRecord> & { findByTokenHash(hash: string): SessionRecord | undefined; extendExpiry(id: string, expiresAt: number): void };
  rooms: InsertRepository<RoomRecord> & { find(id: string): RoomRecord | undefined; findByInvite(code: string): RoomRecord | undefined; prepareNext(id:string,fromGameId:string):void; close(id:string):void; open(): RoomRecord[]; setHost(id: string, memberId: string | null): void; bumpVersion(id: string): void; bumpRoleRevision(id: string): void; bumpPenaltyRevision(id: string): void };
  members: InsertRepository<MemberRecord> & { find(id:string): (MemberRecord & {leftAt:number|null}) | undefined; active(roomId: string): MemberRecord[]; idsForSession(roomId:string,sessionId:string):string[]; touch(id: string, now: number): void; setRole(id: string, role: 'defendant' | 'participant'): void; exclude(id: string, now: number): void; detectDisconnected(now: number, silentMs: number): string[] };
  games: InsertRepository<GameRecord> & { history(sessionId:string,before:{createdAt:number;id:string}|null,limit:number):GameRecord[]; hasActive(roomId: string): boolean; active(roomId:string):GameRecord|undefined; latest(roomId:string):GameRecord|undefined; find(id:string):GameRecord|undefined; update(record:GameRecord):void };
  participants: InsertRepository<ParticipantRecord> & {hasSession(gameId:string,sessionId:string):boolean; list(gameId:string):ParticipantRecord[] };
  rounds: InsertRepository<RoundRecord> & {pending():RoundRecord[];close(gameId:string,number:number,now:number):void;find(gameId:string,number:number):RoundRecord|undefined};
  votes: InsertRepository<VoteRecord> & {list(gameId:string,roundNumber:number):VoteRecord[]; find(gameId: string, roundNumber: number, memberId: string): VoteRecord | undefined };
  drafts: { save(record: DraftRecord): void; find(roomId: string): DraftRecord | undefined };
}
// 저장소 핸들은 콜백 안에서만 유효하다. 비동기 콜백은 허용하지 않는다.
export interface UnitOfWork { run<T>(work: (repositories: Repositories) => T): T }
export class StorageError extends Error {
  constructor(public readonly code: 'busy' | 'constraint' | 'storage', message: string) { super(message); this.name = 'StorageError'; }
}
