export type TallyOutcome = 'guilty'|'not-guilty'|'no-verdict'|'tie';
export function tallyOutcome(guilty:number,notGuilty:number,roundNumber:1|2):TallyOutcome {
  if(guilty+notGuilty===0)return 'no-verdict';
  if(guilty>notGuilty)return 'guilty';
  if(notGuilty>guilty||roundNumber===2)return 'not-guilty';
  return 'tie';
}
