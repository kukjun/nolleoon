export type FailureCode = 'PAYLOAD_TOO_LARGE' | 'TEMPORARILY_UNAVAILABLE' | 'ROOM_CLOSED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'STATE_CONFLICT' | 'DEADLINE_PASSED';
export class DomainFailure extends Error {
  constructor(public readonly code: FailureCode) { super(code); this.name='DomainFailure'; }
}
