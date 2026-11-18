import { closeRoom } from './room-closure.js';
import { assignVacantHost } from './host-transfer.js';
import type { RandomSource } from './ports/random.js';
import { maintainBeforeRequest, maintainRooms, leaveMember } from './membership-lifecycle.js';
import { publishedRounds } from './published-rounds.js';
import { startConditions } from './start-trial.js';
import { consentStatus, validateConsent } from './penalty-consent.js';
import type { UnitOfWork, Repositories, RoomRecord } from './ports/storage.js';
import type { Clock, TokenCodec } from './browser-sessions.js';
import { DomainFailure } from '../domain/failure.js';
export function normalizeNickname(input: unknown): { nickname: string; nicknameKey: string } {
  if (typeof input !== 'string' || /[\p{Cc}\p{Cf}]/u.test(input))
    throw new DomainFailure('INVALID_INPUT');
  const nickname = input.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if ([...nickname].length < 1 || [...nickname].length > 20)
    throw new DomainFailure('INVALID_INPUT');
  return { nickname, nicknameKey: nickname.toLowerCase() };
}
export interface SettingsInput {
  expectedVersion: number;
  caseText: string;
  penaltyText: string;
  durationMinutes: number;
}
export function validateSettings(input: unknown): SettingsInput {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new DomainFailure('INVALID_INPUT');
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).sort().join(',') !==
      'caseText,durationMinutes,expectedVersion,penaltyText' ||
    !Number.isSafeInteger(value.expectedVersion) ||
    Number(value.expectedVersion) < 0 ||
    !Number.isInteger(value.durationMinutes) ||
    Number(value.durationMinutes) < 1 ||
    Number(value.durationMinutes) > 10
  )
    throw new DomainFailure('INVALID_INPUT');
  for (const [key, max] of [
    ['caseText', 2000],
    ['penaltyText', 500],
  ] as const) {
    if (
      typeof value[key] !== 'string' ||
      [...value[key]].length > max ||
      /[\p{Cc}\p{Cf}]/u.test(value[key].replace(/[\n\r\t]/g, ''))
    )
      throw new DomainFailure('INVALID_INPUT');
  }
  return {
    expectedVersion: value.expectedVersion as number,
    caseText: (value.caseText as string).trim(),
    penaltyText: (value.penaltyText as string).trim(),
    durationMinutes: value.durationMinutes as number,
  };
}
export const PRESENCE_SILENCE_MS = 15000;
export class Rooms {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly tokens: TokenCodec,
    private readonly random: RandomSource,
  ) {}
  private run<T>(work: (r: Repositories, now: number) => T): T {
    const now = this.clock.now();
    maintainBeforeRequest(this.uow, now, this.random);
    return this.uow.run((r) => work(r, now));
  }
  close(actor: { id: string }, code: string, expectedMemberId: unknown) {
    if (typeof expectedMemberId !== 'string' || !expectedMemberId || expectedMemberId.length > 100)
      throw new DomainFailure('INVALID_INPUT');
    return this.run((r, now) => {
      const room = this.findRoom(r, code);
      const member = r.members.find(expectedMemberId);
      if (!member || member.roomId !== room.id || member.sessionId !== actor.id)
        throw new DomainFailure('FORBIDDEN');
      if (room.status === 'closed') {
        if (r.closures.find(room.id)?.closedByMemberId !== member.id)
          throw new DomainFailure('FORBIDDEN');
      } else {
        if (member.leftAt != null || room.hostMemberId !== member.id)
          throw new DomainFailure('FORBIDDEN');
        closeRoom(r, room.id, now, member.id);
      }
      return this.snapshot(r, r.rooms.find(room.id)!, actor.id, now);
    });
  }
  leave(actor: { id: string }, code: string, expectedMemberId: unknown) {
    if (typeof expectedMemberId !== 'string' || !expectedMemberId || expectedMemberId.length > 100)
      throw new DomainFailure('INVALID_INPUT');
    return this.run((r, now) => {
      const room = this.findRoom(r, code);
      const member = r.members.find(expectedMemberId);
      if (!member || member.roomId !== room.id || member.sessionId !== actor.id)
        throw new DomainFailure('FORBIDDEN');
      if (room.status === 'closed' && member.leftAt == null) throw new DomainFailure('ROOM_CLOSED');
      if (member.leftAt == null) {
        leaveMember(r, member, now);
        assignVacantHost(r, room.id, now, this.random);
      }
      return { left: true as const, memberId: member.id };
    });
  }
  create(actor: { id: string }, input: unknown) {
    const name = normalizeNickname(input);
    return this.run((r, now) => {
      const room = {
        id: this.tokens.id(),
        inviteCode: this.tokens.token(),
        status: 'open' as const,
        version: 0,
        createdAt: now,
      };
      const member = {
        id: this.tokens.id(),
        roomId: room.id,
        sessionId: actor.id,
        ...name,
        joinedAt: now,
      };
      r.rooms.insert(room);
      r.members.insert(member);
      r.rooms.setHost(room.id, member.id);
      return this.snapshot(r, { ...room, hostMemberId: member.id }, actor.id, now);
    });
  }
  join(actor: { id: string }, code: string, input: unknown) {
    const name = normalizeNickname(input);
    return this.run((r, now) => {
      const room = this.openRoom(r, code);
      const members = r.members.active(room.id);
      // 같은 브라우저의 재시도는 닉네임 변경이나 두 번째 참가가 아니다.
      if (!members.some((m) => m.sessionId === actor.id)) {
        if (members.some((m) => m.nicknameKey === name.nicknameKey))
          throw new DomainFailure('STATE_CONFLICT');
        r.members.insert({
          id: this.tokens.id(),
          roomId: room.id,
          sessionId: actor.id,
          ...name,
          joinedAt: now,
        });
        r.rooms.bumpVersion(room.id);
        room.version++;
      }
      if (assignVacantHost(r, room.id, now, this.random)) {
        Object.assign(room, r.rooms.find(room.id));
      }
      this.observe(r, room, actor.id);
      return this.snapshot(r, room, actor.id, now);
    });
  }
  changeRole(
    actor: { id: string },
    code: string,
    role: unknown,
    expectedPreparationVersion: unknown = 0,
  ) {
    if (role !== 'defendant' && role !== 'participant') throw new DomainFailure('INVALID_INPUT');
    return this.run((r, now) => {
      const room = this.openRoom(r, code);
      const members = r.members.active(room.id);
      const self = members.find((m) => m.sessionId === actor.id);
      if (!self) throw new DomainFailure('FORBIDDEN');
      this.assertPreparation(r, room, expectedPreparationVersion);
      if (r.games.hasActive(room.id)) throw new DomainFailure('STATE_CONFLICT');
      if (self.role !== role) {
        if (role === 'defendant' && members.some((m) => m.role === 'defendant'))
          throw new DomainFailure('STATE_CONFLICT');
        r.members.setRole(self.id, role);
        r.rooms.bumpRoleRevision(room.id);
        r.rooms.bumpVersion(room.id);
        room.roleRevision = (room.roleRevision ?? 0) + 1;
        room.version++;
      }
      return this.snapshot(r, room, actor.id, now);
    });
  }
  excludeMember(
    actor: { id: string },
    code: string,
    memberId: unknown,
    expectedPreparationVersion: unknown = 0,
  ) {
    if (typeof memberId !== 'string' || !memberId || memberId.length > 100)
      throw new DomainFailure('INVALID_INPUT');
    return this.run((r, now) => {
      const room = this.openRoom(r, code);
      const members = r.members.active(room.id);
      const self = members.find((m) => m.sessionId === actor.id);
      if (!self || self.id !== room.hostMemberId || self.id === memberId)
        throw new DomainFailure('FORBIDDEN');
      this.assertPreparation(r, room, expectedPreparationVersion);
      if (r.games.hasActive(room.id)) throw new DomainFailure('STATE_CONFLICT');
      const target = members.find((m) => m.id === memberId);
      if (!target) throw new DomainFailure('NOT_FOUND');
      if (target.disconnectedAt == null) throw new DomainFailure('STATE_CONFLICT');
      r.members.exclude(target.id, now);
      if (target.role === 'defendant') {
        r.rooms.bumpRoleRevision(room.id);
        room.roleRevision = (room.roleRevision ?? 0) + 1;
      }
      r.rooms.bumpVersion(room.id);
      room.version++;
      return this.snapshot(r, room, actor.id, now);
    });
  }
  decideConsent(actor: { id: string }, code: string, input: unknown) {
    const value = validateConsent(input);
    return this.run((r, now) => {
      const room = this.openRoom(r, code);
      const member = r.members.active(room.id).find((m) => m.sessionId === actor.id);
      if (!member || member.role !== 'defendant') throw new DomainFailure('FORBIDDEN');
      this.assertPreparation(r, room, room.preparationVersion ?? 0);
      const draft = r.drafts.find(room.id);
      const previous = r.consents.find(room.id);
      if (
        r.games.hasActive(room.id) ||
        !draft?.penaltyText.trim() ||
        value.roleRevision !== (room.roleRevision ?? 0) ||
        value.penaltyRevision !== (room.penaltyRevision ?? 0) ||
        value.expectedDecisionVersion !== (previous?.version ?? 0)
      )
        throw new DomainFailure('STATE_CONFLICT');
      r.consents.save({
        roomId: room.id,
        memberId: member.id,
        roleRevision: value.roleRevision,
        penaltyRevision: value.penaltyRevision,
        decision: value.decision,
        version: value.expectedDecisionVersion + 1,
      });
      r.rooms.bumpVersion(room.id);
      room.version++;
      return this.snapshot(r, room, actor.id, now);
    });
  }
  saveSettings(actor: { id: string }, code: string, input: unknown) {
    const draft = validateSettings(input);
    return this.run((r, now) => {
      const room = this.openRoom(r, code);
      const self = r.members.active(room.id).find((m) => m.sessionId === actor.id);
      if (!self || room.hostMemberId !== self.id) throw new DomainFailure('FORBIDDEN');
      this.assertPreparation(r, room, room.preparationVersion ?? 0);
      if (r.games.hasActive(room.id)) throw new DomainFailure('STATE_CONFLICT');
      const current = r.drafts.find(room.id);
      if ((current?.version ?? 0) !== draft.expectedVersion)
        throw new DomainFailure('STATE_CONFLICT');
      if ((current?.penaltyText ?? '') !== draft.penaltyText) {
        r.rooms.bumpPenaltyRevision(room.id);
        room.penaltyRevision = (room.penaltyRevision ?? 0) + 1;
      }
      r.drafts.save({
        roomId: room.id,
        caseText: draft.caseText,
        penaltyText: draft.penaltyText,
        durationSeconds: draft.durationMinutes * 60,
        version: draft.expectedVersion + 1,
      });
      r.rooms.bumpVersion(room.id);
      room.version++;
      return this.snapshot(r, room, actor.id, now);
    });
  }
  sweep() {
    return this.uow.run((r) => maintainRooms(r, this.clock.now(), this.random));
  }
  heartbeat(actor: { id: string }, code: string) {
    return this.run((r, now) => {
      const room = this.findRoom(r, code);
      if (room.status === 'closed') return this.snapshot(r, room, actor.id, now);
      const member = r.members.active(room.id).find((m) => m.sessionId === actor.id);
      if (!member) throw new DomainFailure('FORBIDDEN');
      r.members.touch(member.id, now);
      if (member.disconnectedAt != null) {
        r.rooms.bumpVersion(room.id);
        room.version++;
      }
      if (assignVacantHost(r, room.id, now, this.random)) {
        Object.assign(room, r.rooms.find(room.id));
      }
      this.observe(r, room, actor.id);
      return this.snapshot(r, room, actor.id, now);
    });
  }
  read(actor: { id: string }, code: string, gameId?: string) {
    return this.run((r, now) => this.snapshot(r, this.findRoom(r, code), actor.id, now, gameId));
  }
  history(actor: { id: string }, code: string, gameId: string) {
    return this.run((r, now) => this.historyProjection(r, actor, this.findRoom(r, code), gameId, now));
  }
  // Reuse exact legacy disclosure rules without lifecycle writes for account-linked archive reads.
  historyProjection(r: Repositories, actor: {id:string}, room: RoomRecord, gameId: string, now: number) {
    const game = r.games.find(gameId);
    if (!game || game.roomId !== room.id) throw new DomainFailure('NOT_FOUND');
    const ids = r.members.idsForSession(room.id, actor.id);
    if (!r.participants.list(gameId).some((p) => ids.includes(p.memberId)))
      throw new DomainFailure('FORBIDDEN');
    if (!['result', 'interrupted'].includes(game.status))
      throw new DomainFailure('STATE_CONFLICT');
    const snapshot = this.snapshot(r, room, actor.id, now, gameId);
    return {
      gameId,
      game: snapshot.game,
      interrupted: snapshot.interrupted,
      interruption: snapshot.interruption,
    };
  }
  private assertPreparation(r: Repositories, room: RoomRecord, expected: unknown) {
    if (!Number.isSafeInteger(expected) || Number(expected) < 0)
      throw new DomainFailure('INVALID_INPUT');
    const latest = r.games.latest(room.id);
    if (
      (room.preparationVersion ?? 0) !== expected ||
      r.games.hasActive(room.id) ||
      (latest && room.preparedAfterGameId !== latest.id)
    )
      throw new DomainFailure('STATE_CONFLICT');
  }
  private findRoom(r: Repositories, code: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw new DomainFailure('NOT_FOUND');
    const room = r.rooms.findByInvite(code);
    if (!room) throw new DomainFailure('NOT_FOUND');
    return room;
  }
  private openRoom(r: Repositories, code: string) {
    const room = this.findRoom(r, code);
    if (room.status === 'closed') throw new DomainFailure('ROOM_CLOSED');
    return room;
  }
  private observe(r: Repositories, room: RoomRecord, sessionId: string) {
    const game = r.games.active(room.id);
    if (!game) return;
    const member = r.members.active(room.id).find((m) => m.sessionId === sessionId);
    if (member && !r.participants.list(game.id).some((p) => p.memberId === member.id)) {
      r.participants.insert({
        gameId: game.id,
        roomId: room.id,
        memberId: member.id,
        role: 'observer',
        eligible: false,
      });
      r.rooms.bumpVersion(room.id);
      room.version++;
    }
  }
  private snapshot(
    r: Repositories,
    room: RoomRecord,
    sessionId: string,
    now: number,
    gameId?: string,
  ) {
    const members = r.members.active(room.id);
    const historicalIds = r.members.idsForSession(room.id, sessionId);
    const self =
      members.find((m) => m.sessionId === sessionId) ??
      (room.status === 'closed' || gameId
        ? historicalIds.map((id) => r.members.find(id)).find(Boolean)
        : undefined);
    if (!self) throw new DomainFailure(room.status === 'closed' ? 'ROOM_CLOSED' : 'FORBIDDEN');
    const saved = r.drafts.find(room.id);
    let draft = {
      version: saved?.version ?? 0,
      caseText: saved?.caseText ?? '',
      penaltyText: saved?.penaltyText ?? '',
      durationMinutes: (saved?.durationSeconds ?? 180) / 60,
    };
    const defendant = members.find((m) => m.role === 'defendant');
    const record = r.consents.find(room.id);
    let consent = {
      penaltyRevision: room.penaltyRevision ?? 0,
      roleRevision: room.roleRevision ?? 0,
      decisionVersion: record?.version ?? 0,
      status: consentStatus(
        {
          memberId: defendant?.id ?? null,
          roleRevision: room.roleRevision ?? 0,
          penaltyRevision: room.penaltyRevision ?? 0,
          penaltyText: draft.penaltyText,
        },
        record,
      ),
      defendantMemberId: defendant?.id ?? null,
      canDecide:
        self.id === defendant?.id &&
        Boolean(draft.penaltyText.trim()) &&
        !r.games.hasActive(room.id),
    };
    const latest = r.games.latest(room.id);
    const prepared = latest && room.preparedAfterGameId === latest.id;
    const candidate = gameId ? r.games.find(gameId) : prepared ? undefined : latest;
    const participants = candidate?.roomId === room.id ? r.participants.list(candidate.id) : [];
    const active = candidate && !['result', 'interrupted'].includes(candidate.status);
    const participation =
      participants.find((p) => p.memberId === self.id) ??
      (!active ? participants.find((p) => historicalIds.includes(p.memberId)) : undefined);
    const firstRound = candidate
      ? (r.rounds.find(candidate.id, 2) ?? r.rounds.find(candidate.id, 1))
      : undefined;
    const defenseRound =
      candidate?.status === 'final-defense' || firstRound?.number === 2
        ? (2 as const)
        : (1 as const);
    const response = candidate ? r.defenses.find(candidate.id, defenseRound) : undefined;
    const ownVote =
      candidate && participation && firstRound
        ? r.votes.find(candidate.id, firstRound.number, participation.memberId)
        : undefined;
    const settlement =
      candidate && firstRound ? r.settlements.find(candidate.id, firstRound.number) : undefined;
    const game =
      candidate && candidate.status !== 'interrupted' && participation
        ? {
            publishedRounds: publishedRounds(r, candidate.id),
            settlement: settlement
              ? {
                  roundNumber: settlement.roundNumber,
                  outcome: settlement.outcome,
                  guilty: settlement.guilty,
                  notGuilty: settlement.notGuilty,
                  abstain: settlement.abstain,
                  total: settlement.total,
                  closedAt: settlement.closedAt,
                  closedBy: settlement.closedBy,
                }
              : null,
            ownVote: ownVote
              ? { roundNumber: ownVote.roundNumber, choice: ownVote.choice, reason: ownVote.reason }
              : null,
            gameId: candidate.id,
            version: candidate.version,
            serverNow: now,
            round: firstRound
              ? {
                  number: firstRound.number,
                  startedAt: firstRound.startedAt,
                  deadline: firstRound.deadline,
                }
              : null,
            defense: {
              roundNumber: defenseRound,
              status: response?.action ?? ('pending' as 'pending' | 'submitted' | 'skipped'),
              text: response?.action === 'submitted' ? response.text : null,
            },
            status: candidate.status,
            caseText: candidate.caseText,
            penaltyText: candidate.penaltyText,
            durationMinutes: candidate.durationSeconds / 60,
            self: { role: participation.role, eligible: participation.eligible },
            participantCount: new Set(
              participants.map((p) => r.members.find(p.memberId)?.sessionId).filter(Boolean),
            ).size,
            voterCount: participants.filter((p) => p.eligible).length,
          }
        : null;
    if (
      room.status === 'closed' ||
      (candidate && (candidate.status === 'interrupted' || (!active && !participation)))
    ) {
      draft = { ...draft, caseText: '', penaltyText: '', durationMinutes: 3 };
      consent = { ...consent, status: 'pending', defendantMemberId: null, canDecide: false };
    }
    const preparing = !latest || Boolean(prepared);
    const privateMetadata = Boolean(
      candidate && ((!active && !participation) || candidate.status === 'interrupted'),
    );
    if (privateMetadata) {
      draft = { ...draft, version: 0 };
      consent = {
        ...consent,
        roleRevision: 0,
        penaltyRevision: 0,
        decisionVersion: 0,
        status: 'pending',
        defendantMemberId: null,
        canDecide: false,
      };
    }
    if (!preparing) consent = { ...consent, canDecide: false };
    const conditions = preparing ? startConditions(r, room, now) : { missing: [] as string[] };
    const start = {
      canStart:
        room.status === 'open' &&
        preparing &&
        self.id === room.hostMemberId &&
        conditions.missing.length === 0,
      missing: conditions.missing,
    };
    const interrupted = Boolean(participation) && candidate?.status === 'interrupted';
    const interruption = interrupted
      ? {
          caseText:
            r.interruptions.find(candidate!.id)?.cause === 'room-closed'
              ? candidate!.caseText
              : null,
        }
      : null;
    const historyCandidate =
      latest && ['result', 'interrupted'].includes(latest.status)
        ? latest
        : room.preparedAfterGameId
          ? r.games.find(room.preparedAfterGameId)
          : undefined;
    const historyGameId =
      historyCandidate &&
      r.participants.list(historyCandidate.id).some((p) => historicalIds.includes(p.memberId))
        ? historyCandidate.id
        : null;
    const canPrepare =
      room.status === 'open' &&
      self.id === room.hostMemberId &&
      Boolean(latest && ['result', 'interrupted'].includes(latest.status) && !prepared);
    return {
      preparationVersion: room.preparationVersion ?? 0,
      nextGame: { canPrepare, fromGameId: canPrepare ? latest!.id : null },
      historyGameId,
      closed: room.status === 'closed',
      interruption,
      interrupted,
      roomId: room.id,
      game,
      start,
      consent,
      roleRevision: privateMetadata ? 0 : (room.roleRevision ?? 0),
      rosterEditable: preparing && room.status === 'open' && !r.games.hasActive(room.id),
      draft,
      version: room.version,
      inviteCode: room.inviteCode,
      self: { memberId: self.id, isHost: self.id === room.hostMemberId },
      members: (room.status === 'closed' ? [] : members).map((m) => ({
        memberId: m.id,
        nickname: m.nickname,
        role:
          preparing || Boolean(active && participation) ? (m.role ?? 'participant') : 'participant',
        connected: m.disconnectedAt == null,
        isHost: m.id === room.hostMemberId,
      })),
    };
  }
}
