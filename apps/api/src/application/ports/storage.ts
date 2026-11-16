export interface SessionRecord { id: string; tokenHash: string; createdAt: number; expiresAt: number }
export interface RoomRecord { id: string; inviteCode: string; status: 'open' | 'closed'; version: number; createdAt: number }
export interface MemberRecord { id: string; roomId: string; sessionId: string; nickname: string; nicknameKey: string; joinedAt: number }
export interface GameRecord { id: string; roomId: string; status: 'draft' | 'defense' | 'voting' | 'final-defense' | 'result' | 'interrupted'; caseText: string; penaltyText: string; durationSeconds: number; version: number; createdAt: number }
export interface ParticipantRecord { gameId: string; roomId: string; memberId: string; role: 'defendant' | 'participant' | 'observer'; eligible: boolean }
export interface RoundRecord { gameId: string; number: 1 | 2; startedAt: number; deadline: number }
export interface VoteRecord { gameId: string; roundNumber: 1 | 2; memberId: string; choice: 'guilty' | 'not-guilty' | 'abstain'; reason: string; requestId: string; submittedAt: number }
export interface DraftRecord { roomId: string; caseText: string; penaltyText: string; durationSeconds: number; version: number }
export interface InsertRepository<T> { insert(record: T): void }
export interface Repositories {
  sessions: InsertRepository<SessionRecord> & { findByTokenHash(hash: string): SessionRecord | undefined; extendExpiry(id: string, expiresAt: number): void };
  rooms: InsertRepository<RoomRecord> & { find(id: string): RoomRecord | undefined };
  members: InsertRepository<MemberRecord>;
  games: InsertRepository<GameRecord>;
  participants: InsertRepository<ParticipantRecord>;
  rounds: InsertRepository<RoundRecord>;
  votes: InsertRepository<VoteRecord> & { find(gameId: string, roundNumber: number, memberId: string): VoteRecord | undefined };
  drafts: { save(record: DraftRecord): void; find(roomId: string): DraftRecord | undefined };
}
// 저장소 핸들은 콜백 안에서만 유효하다. 비동기 콜백은 허용하지 않는다.
export interface UnitOfWork { run<T>(work: (repositories: Repositories) => T): T }
export class StorageError extends Error {
  constructor(public readonly code: 'busy' | 'constraint' | 'storage', message: string) { super(message); this.name = 'StorageError'; }
}
