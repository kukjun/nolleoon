export class FakeClock {
  constructor(now = 0) {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('초기 시간은 0 이상 정수여야 합니다.');
    this.value = now;
  }
  now() { return this.value; }
  advance(ms) {
    if (!Number.isSafeInteger(ms) || ms < 0 || !Number.isSafeInteger(this.value + ms)) throw new Error('시간은 안전한 정수 범위 안에서 증가해야 합니다.');
    this.value += ms;
  }
}
export class SequenceRandom {
  constructor(values) { this.values = [...values]; }
  nextInt(exclusiveMax) {
    const value = this.values[0];
    if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax <= 0 || !Number.isInteger(value) || value < 0 || value >= exclusiveMax) throw new Error('정해진 난수 또는 후보 범위를 확인하세요.');
    this.values.shift();
    return value;
  }
}
// 테스트가 난수 자체를 검증하지 않을 때도 provider 의존성을 명시한다.
export const firstCandidateRandom = {nextInt:()=>0};
