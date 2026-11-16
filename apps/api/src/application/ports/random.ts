// 후보 수를 입력받아 [0, upperExclusive) 정수 하나를 선택한다.
export interface RandomSource {nextInt(upperExclusive:number):number}
