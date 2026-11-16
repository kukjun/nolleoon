import {maintainBeforeRequest} from './membership-lifecycle.js';
import type { UnitOfWork, Repositories } from './ports/storage.js';
import type { Clock } from './browser-sessions.js';
import { DomainFailure } from '../domain/failure.js';

function input(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainFailure('INVALID_INPUT');
  }
  const data = value as Record<string, unknown>;
  const validKeys = Object.keys(data).sort().join(',') === keys.sort().join(',');
  if (!validKeys || !Number.isSafeInteger(data.expectedVersion) || Number(data.expectedVersion) < 0) {
    throw new DomainFailure('INVALID_INPUT');
  }
  return data;
}

export class TrialProgress {
  constructor(private readonly uow: UnitOfWork, private readonly clock: Clock) {}

  private context(r: Repositories, actor: {id: string}, code: string, gameId: string) {
    const room = r.rooms.findByInvite(code);
    const game = r.games.find(gameId);
    if (!room || room.status !== 'open' || !game || game.roomId !== room.id) {
      throw new DomainFailure('NOT_FOUND');
    }
    const member = r.members.active(room.id).find(m => m.sessionId === actor.id);
    const participant = member && r.participants.list(game.id).find(p => p.memberId === member.id);
    if (!member || !participant) throw new DomainFailure('FORBIDDEN');
    return {room, game, member, participant};
  }

  private editable(r: Repositories, game: {id: string; status: string; version: number}, expected: unknown, roundNumber:1|2) {
    const phase=roundNumber===1?'defense':'final-defense';
    const firstTie=roundNumber===1||r.settlements.find(game.id,1)?.outcome==='tie';
    if (game.status !== phase || !firstTie || game.version !== expected || r.rounds.find(game.id, roundNumber)) {
      throw new DomainFailure('STATE_CONFLICT');
    }
  }

  defense(actor: {id: string}, code: string, gameId: string, value: unknown) {
    const data = input(value, ['roundNumber','expectedVersion', 'action', 'text']);
    if(data.roundNumber!==1&&data.roundNumber!==2)throw new DomainFailure('INVALID_INPUT');
    const roundNumber=data.roundNumber;
    const validAction = data.action === 'submit' || data.action === 'skip';
    if (!validAction || typeof data.text !== 'string' || [...data.text].length > 5000) {
      throw new DomainFailure('INVALID_INPUT');
    }
    const forbiddenControl = /[\p{Cc}\p{Cf}]/u.test(data.text.replace(/[\n\r\t]/g, ''));
    const invalidSubmission = data.action === 'submit' && !data.text.trim();
    const invalidSkip = data.action === 'skip' && data.text !== '';
    if (forbiddenControl || invalidSubmission || invalidSkip) throw new DomainFailure('INVALID_INPUT');
    const text = data.text.trim();
    const action = data.action === 'submit' ? 'submitted' : 'skipped';

    const now=this.clock.now();
    maintainBeforeRequest(this.uow,now);
    this.uow.run(r => {
      const {room, game, member, participant} = this.context(r, actor, code, gameId);
      if (participant.role !== 'defendant') throw new DomainFailure('FORBIDDEN');
      this.editable(r, game, data.expectedVersion, roundNumber);
      r.defenses.save({gameId, roundNumber, memberId: member.id, action, text});
      r.games.update({...game, version: game.version + 1});
      r.rooms.bumpVersion(room.id);
    });
  }

  duration(actor: {id: string}, code: string, gameId: string, value: unknown) {
    const data = input(value, ['expectedVersion', 'durationMinutes']);
    if (!Number.isInteger(data.durationMinutes) || Number(data.durationMinutes) < 1 || Number(data.durationMinutes) > 10) {
      throw new DomainFailure('INVALID_INPUT');
    }
    const now=this.clock.now();
    maintainBeforeRequest(this.uow,now);
    this.uow.run(r => {
      const {room, game, member} = this.context(r, actor, code, gameId);
      if (member.id !== room.hostMemberId) throw new DomainFailure('FORBIDDEN');
      this.editable(r, game, data.expectedVersion, 1);
      const seconds = Number(data.durationMinutes) * 60;
      if (seconds !== game.durationSeconds) {
        r.games.update({...game, durationSeconds: seconds, version: game.version + 1});
        r.rooms.bumpVersion(room.id);
      }
    });
  }

  open(actor: {id: string}, code: string, gameId: string, value: unknown) {
    const data = input(value, ['roundNumber','expectedVersion', 'requestId']);
    if (typeof data.requestId !== 'string' || !/^[-a-zA-Z0-9_]{16,100}$/.test(data.requestId)) {
      throw new DomainFailure('INVALID_INPUT');
    }
    if(data.roundNumber!==1&&data.roundNumber!==2)throw new DomainFailure('INVALID_INPUT');
    const roundNumber=data.roundNumber;
    const requestId = data.requestId;
    const now=this.clock.now();
    maintainBeforeRequest(this.uow,now);
    this.uow.run(r => {
      const {room, game, member} = this.context(r, actor, code, gameId);
      const receipt = r.opens.find(gameId, requestId);
      if (receipt) {
        if (receipt.actorSessionId !== actor.id) throw new DomainFailure('FORBIDDEN');
        if (receipt.intent !== data.expectedVersion || receipt.roundNumber !== roundNumber) throw new DomainFailure('STATE_CONFLICT');
        return;
      }
      if (member.id !== room.hostMemberId) throw new DomainFailure('FORBIDDEN');
      this.editable(r, game, data.expectedVersion, roundNumber);
      r.rounds.insert({gameId, number: roundNumber, startedAt: now, deadline: now + game.durationSeconds * 1000});
      r.games.update({...game, status: 'voting', version: game.version + 1});
      r.opens.insert({gameId, requestId, actorSessionId: actor.id, intent: data.expectedVersion as number, roundNumber});
      r.rooms.bumpVersion(room.id);
    });
  }
}
