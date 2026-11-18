import { DomainFailure } from '../domain/failure.js';
import { beginMenu, cancelMenu, projectMenu, submitMenu, type MenuState } from '../domain/menu.js';
import type { RandomSource } from './ports/random.js';
import type { TravelGameContext, TravelGameEngine, TravelTransition } from './ports/travel-engine.js';

function emptySettings(settings: unknown): void {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).length !== 0) {
    throw new DomainFailure('INVALID_INPUT');
  }
}
function storedState(value: unknown): MenuState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainFailure('STATE_CONFLICT');
  const state = value as MenuState;
  if (!['collecting', 'completed', 'incomplete'].includes(state.phase)
    || !Array.isArray(state.participantIds) || !Array.isArray(state.responses)) throw new DomainFailure('STATE_CONFLICT');
  return state;
}
function transition(state: MenuState): TravelTransition {
  return { status: state.phase === 'collecting' ? 'active' : state.phase, state, result: state.result };
}

/** Persistence, room membership checks and request receipts are owned by the travel application transaction. */
export class TravelMenuEngine implements TravelGameEngine {
  readonly type = 'menu' as const;
  constructor(private readonly random: RandomSource) {}

  prepare(settings: unknown, _context: TravelGameContext) {
    void _context;
    emptySettings(settings);
    return { settings: {}, state: { phase: 'draft' } };
  }

  start(settings: unknown, state: unknown, context: TravelGameContext): TravelTransition {
    emptySettings(settings);
    if (context.status !== 'draft' || !state || typeof state !== 'object'
      || (state as { phase?: unknown }).phase !== 'draft') throw new DomainFailure('STATE_CONFLICT');
    return transition(beginMenu(context.participantIds));
  }

  action(settings: unknown, state: unknown, command: unknown, context: TravelGameContext): TravelTransition {
    emptySettings(settings);
    const current = storedState(state);
    const expectedStatus = current.phase === 'collecting' ? 'active' : current.phase;
    if (context.status !== expectedStatus) throw new DomainFailure('STATE_CONFLICT');
    if (command && typeof command === 'object' && !Array.isArray(command)
      && (command as { type?: unknown }).type === 'cancel') {
      if (Object.keys(command).length !== 1) throw new DomainFailure('INVALID_INPUT');
      return transition(cancelMenu(current, context.actorMembershipId, context.facilitatorMembershipId));
    }
    return transition(submitMenu(current, context.actorMembershipId, command, this.random));
  }

  project(settings: unknown, state: unknown, _result: unknown | null, context: TravelGameContext): unknown {
    emptySettings(settings);
    if (context.status === 'draft') {
      return { kind: 'menu', phase: 'draft', self: { eligible: context.participantIds.includes(context.actorMembershipId), submission: null }, result: null };
    }
    // The common draft-cancel command preserves the original draft state; no ballots ever existed.
    if (context.status === 'incomplete' && state && typeof state === 'object'
      && !Array.isArray(state) && (state as { phase?: unknown }).phase === 'draft') {
      return { kind: 'menu', phase: 'incomplete', self: { eligible: false, submission: null }, result: null };
    }
    return projectMenu(storedState(state), context.actorMembershipId);
  }
}
