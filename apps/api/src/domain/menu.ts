import { DomainFailure } from './failure.js';

export type MenuSubmission = { kind: 'candidate'; menu: string } | { kind: 'pass' };
export type MenuResult = { outcome: 'selected'; menu: string } | { outcome: 'no-choice' };
export interface MenuState {
  phase: 'collecting' | 'completed' | 'incomplete';
  participantIds: string[];
  responses: { participantId: string; submission: MenuSubmission }[];
  result: MenuResult | null;
}
export interface MenuRandom { nextInt(upperExclusive: number): number }
export interface MenuProjection {
  kind: 'menu';
  phase: MenuState['phase'];
  self: { eligible: boolean; submission: MenuSubmission | null };
  result: MenuResult | null;
}

/** Candidate labels are canonical too, so spelling/case does not reveal submission order. */
export function normalizeMenu(value: unknown): string {
  if (typeof value !== 'string') throw new DomainFailure('INVALID_INPUT');
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ')
    .replace(/\p{Script=Latin}/gu, letter => letter.toLowerCase());
  if (!normalized || Array.from(normalized).length > 80 || /[\p{Cc}\p{Cf}]/u.test(normalized)) {
    throw new DomainFailure('INVALID_INPUT');
  }
  return normalized;
}

export function beginMenu(participantIds: string[]): MenuState {
  if (participantIds.length < 2 || new Set(participantIds).size !== participantIds.length
    || participantIds.some(id => typeof id !== 'string' || !id)) throw new DomainFailure('INVALID_INPUT');
  return { phase: 'collecting', participantIds: [...participantIds], responses: [], result: null };
}

function parseSubmission(command: unknown): MenuSubmission {
  if (typeof command !== 'object' || command === null || Array.isArray(command)) throw new DomainFailure('INVALID_INPUT');
  const input = command as Record<string, unknown>;
  const keys = Object.keys(input).sort().join(',');
  if (input.type === 'pass' && keys === 'type') return { kind: 'pass' };
  if (input.type === 'submit' && keys === 'menu,type') return { kind: 'candidate', menu: normalizeMenu(input.menu) };
  throw new DomainFailure('INVALID_INPUT');
}

function sameSubmission(left: MenuSubmission, right: MenuSubmission): boolean {
  return left.kind === right.kind && (left.kind === 'pass' || (right.kind === 'candidate' && left.menu === right.menu));
}

function chooseResult(responses: MenuState['responses'], random: MenuRandom): MenuResult {
  const counts = new Map<string, number>();
  for (const { submission } of responses) {
    if (submission.kind === 'candidate') counts.set(submission.menu, (counts.get(submission.menu) ?? 0) + 1);
  }
  if (counts.size === 0) return { outcome: 'no-choice' };
  const highest = Math.max(...counts.values());
  const finalists = [...counts].filter(([, count]) => count === highest).map(([menu]) => menu).sort();
  const index = finalists.length === 1 ? 0 : random.nextInt(finalists.length);
  if (!Number.isInteger(index) || index < 0 || index >= finalists.length) throw new Error('Invalid random index');
  return { outcome: 'selected', menu: finalists[index]! };
}

/** Returns a new state only. The caller persists state/result in the same command transaction. */
export function submitMenu(state: MenuState, actorId: string, command: unknown, random: MenuRandom): MenuState {
  if (!state.participantIds.includes(actorId)) throw new DomainFailure('FORBIDDEN');
  if (state.phase === 'incomplete') throw new DomainFailure('STATE_CONFLICT');
  const submission = parseSubmission(command);
  const previous = state.responses.find(response => response.participantId === actorId);
  if (previous) {
    if (sameSubmission(previous.submission, submission)) return state;
    throw new DomainFailure('STATE_CONFLICT');
  }
  if (state.phase !== 'collecting') throw new DomainFailure('STATE_CONFLICT');
  const responses = [...state.responses, { participantId: actorId, submission }];
  if (responses.length < state.participantIds.length) return { ...state, responses };
  return { ...state, responses, phase: 'completed', result: chooseResult(responses, random) };
}

export function cancelMenu(state: MenuState, actorId: string, facilitatorId: string | null): MenuState {
  if (!facilitatorId || actorId !== facilitatorId || !state.participantIds.includes(actorId)) throw new DomainFailure('FORBIDDEN');
  if (state.phase === 'completed') throw new DomainFailure('STATE_CONFLICT');
  if (state.phase === 'incomplete') return state;
  return { ...state, phase: 'incomplete', result: null };
}

/** Room membership authorization belongs to the application service before calling this projector. */
export function projectMenu(state: MenuState, actorId: string): MenuProjection {
  const response = state.phase === 'collecting' ? state.responses.find(item => item.participantId === actorId) : undefined;
  const submission = response?.submission;
  return {
    kind: 'menu', phase: state.phase,
    self: { eligible: state.participantIds.includes(actorId), submission: !submission ? null : submission.kind === 'pass'
      ? { kind: 'pass' } : { kind: 'candidate', menu: submission.menu } },
    result: state.phase !== 'completed' || !state.result ? null : state.result.outcome === 'no-choice'
      ? { outcome: 'no-choice' } : { outcome: 'selected', menu: state.result.menu },
  };
}
