import {maintainBeforeRequest} from './membership-lifecycle.js';
import {settleRound} from './settle-round.js';
import type {UnitOfWork, VoteRecord} from './ports/storage.js';
import type {Clock} from './browser-sessions.js';
import {DomainFailure} from '../domain/failure.js';

type VoteInput = Pick<VoteRecord, 'roundNumber'|'requestId'|'choice'|'reason'>;
function validate(value: unknown): VoteInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainFailure('INVALID_INPUT');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(',') !== 'choice,reason,requestId,roundNumber'
    || (input.roundNumber !== 1 && input.roundNumber !== 2)
    || typeof input.requestId !== 'string' || !/^[-a-zA-Z0-9_]{16,100}$/.test(input.requestId)
    || (input.choice !== 'guilty' && input.choice !== 'not-guilty' && input.choice !== 'abstain')
    || typeof input.reason !== 'string' || [...input.reason].length > 2000
    || /[\p{Cc}\p{Cf}]/u.test(input.reason.replace(/[\n\r\t]/g, ''))
    || (input.choice !== 'abstain' && !input.reason.trim())) throw new DomainFailure('INVALID_INPUT');
  return {roundNumber:input.roundNumber,requestId:input.requestId,choice:input.choice,reason:input.reason.trim()};
}

export class SubmitVote {
  constructor(private readonly uow: UnitOfWork, private readonly clock: Clock) {}
  execute(actor: {id:string}, code:string, gameId:string, value:unknown) {
    const input = validate(value);
    const now = this.clock.now();
    maintainBeforeRequest(this.uow,now);
  return this.uow.run(r => {
      const room = r.rooms.findByInvite(code);
      const game = r.games.find(gameId);
      if (!room || room.status !== 'open' || !game || game.roomId !== room.id) throw new DomainFailure('NOT_FOUND');
      const member = r.members.active(room.id).find(m => m.sessionId === actor.id);
      const participant = member && r.participants.list(gameId).find(p => p.memberId === member.id);
      if (!member || !participant || participant.role !== 'participant' || !participant.eligible) throw new DomainFailure('FORBIDDEN');
      const previous = r.votes.find(gameId, input.roundNumber, member.id);
      if (previous) {
        if (previous.requestId !== input.requestId || previous.choice !== input.choice || previous.reason !== input.reason) {
          throw new DomainFailure('STATE_CONFLICT');
        }
        // 이미 접수된 본인 의도의 재시도는 마감 뒤에도 새 표를 만들지 않는다.
        return {gameId,roundNumber:previous.roundNumber,choice:previous.choice,reason:previous.reason};
      }
      const current = r.rounds.find(gameId, 2) ?? r.rounds.find(gameId, 1);
      if (!current || current.number !== input.roundNumber) throw new DomainFailure('STATE_CONFLICT');
      if (now >= current.deadline) throw new DomainFailure('DEADLINE_PASSED');
      if (game.status !== 'voting' || current.closedAt != null) throw new DomainFailure('STATE_CONFLICT');
      r.votes.insert({...input,gameId,memberId:member.id,submittedAt:now});
      settleRound(r,gameId,now);
      // 개인 접수는 비공개이며 정산 전까지 공용 version을 바꾸지 않는다.
      return {gameId,roundNumber:input.roundNumber,choice:input.choice,reason:input.reason};
    });
  }
}
