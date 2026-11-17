import {useRef,useState} from 'react';
import type {PartySnapshot} from '@trip-court/contracts';
import {Button,Status} from './design/components';
import {MemberAvatar} from './avatar';
import type {PartyCommand,PartyResponse} from './api/party-client';
export function PartyRunView({party,busy,send}:{party:PartySnapshot;busy:boolean;send:(command:PartyCommand)=>Promise<PartyResponse|undefined>}){
 const run=party.run!;const [revealIntent,setRevealIntent]=useState<Extract<PartyCommand,{kind:'reveal'}>|null>(null);const [nextIntent,setNextIntent]=useState<Extract<PartyCommand,{kind:'next'}>|null>(null);const lock=useRef(false);
 async function act(command:PartyCommand){if(lock.current||busy)return;lock.current=true;try{await send(command);}finally{lock.current=false;}}
 const result=run.result;const blocked=run.blockedPolicy||party.blockedPolicy;
 const selfResult=result?.kind==='draw'?result.revealed.find(row=>row.memberId===party.self.memberId):undefined;
 function reveal(){const command=revealIntent??{kind:'reveal',runId:run.runId,requestId:crypto.randomUUID()};setRevealIntent(command);void act(command);}
 function next(){const command=nextIntent??{kind:'next',fromRunId:run.runId,expectedSelectionVersion:party.selection.version,requestId:crypto.randomUUID()};setNextIntent(command);void act(command);}
 return <section className="party-run"><span className="eyebrow">{run.type==='team'?'TEAM RESULT':'MY OWN LOT'}</span><h2>{run.status==='interrupted'?'게임이 중단됐어요':!run.self.eligible?'친구들의 게임을 보고 있어요':run.type==='team'?'이렇게 한 팀!':selfResult?selfResult.winner?'내 제비는 당첨!':'이번엔 통과!':'내 제비를 뒤집어요'}</h2>
 {blocked&&<p role="alert" className="field-error">공개하지 않은 참가자의 참여가 끝났어요. 남은 제비 처리 규칙이 정해질 때까지 진행을 보류해요. 자동 공개하거나 다시 배정하지 않아요.</p>}
 {!run.self.eligible&&<Status>게임 시작 후 참여해 관전 중이에요. 참가자의 결과는 공개하지 않아요.</Status>}
 {result?.kind==='team'&&<div className="party-teams">{Array.from({length:run.settings.teamCount},(_,i)=>i+1).map(team=><section key={team} className="party-team"><h3>{team}팀</h3><ul>{result.assignments.filter(a=>a.team===team).map(a=>{const member=run.participants.find(p=>p.memberId===a.memberId);return member?<li key={a.memberId}><MemberAvatar memberId={member.memberId} nickname={member.nickname}/><strong>{member.nickname}</strong></li>:null;})}</ul></section>)}</div>}
 {run.type==='team'&&<p className="field-hint">팀 인원 차이는 최대 한 명. 팀만 나누고 벌칙은 없어요.</p>}
 {run.type==='draw'&&run.self.eligible&&run.status!=='interrupted'&&<><div className={`party-own-lot ${run.self.revealed?'is-revealed':''}`}><span aria-hidden="true">{selfResult?selfResult.winner?'★':'✓':'?'}</span><strong>{run.self.revealed?'내 제비 공개 완료':'나에게 배정된 한 장'}</strong></div>{run.self.eligible&&!run.self.revealed&&run.status==='active'&&<div className="party-primary"><Button disabled={busy||Boolean(blocked)} onPress={reveal}>{revealIntent?'같은 공개 요청 다시 확인':'내 제비 뒤집기'}</Button></div>}{run.self.revealed&&<Status tone="success">내 선택은 접수됐어요. 다시 뒤집거나 바꿀 수 없어요.</Status>}
 <section className="party-saved-summary"><h3>당첨 {run.settings.winnerCount}명 · 이번에 할 일</h3><p>{run.settings.penaltyText||'정해진 벌칙이 없어요.'}</p><p className="field-hint">당첨 수와 공개된 결과로 남은 결과가 추론될 수 있어요.</p></section>
 <ul className="party-reveal-list">{run.participants.map(member=>{const row=result?.kind==='draw'?result.revealed.find(r=>r.memberId===member.memberId):undefined;return <li key={member.memberId}><MemberAvatar memberId={member.memberId} nickname={member.nickname} size="small"/><strong>{member.nickname}</strong><span>{row?row.winner?'당첨':'통과':'아직 공개하지 않았어요'}</span></li>;})}</ul></>}
 {run.status==='completed'&&<Status tone="success">이번 게임이 끝났어요.</Status>}{run.status==='interrupted'&&<Status tone="warning">게임이 중단됐어요.</Status>}
 {party.self.isHost&&run.status==='completed'&&!blocked&&<div className="party-primary"><Button disabled={busy} onPress={next}>{nextIntent?'같은 다음 게임 요청 확인':'같은 친구들과 다음 게임'}</Button></div>}
 </section>;
}
