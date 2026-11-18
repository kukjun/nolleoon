import {record} from './travel-client.ts';
import type {TrialProjection} from '../travel-trial-panel.tsx';
import type {MenuProjection} from '../travel-menu-panel.tsx';
const integer=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
export function validTrialProjection(x:unknown):x is TrialProjection{
 if(!record(x)||x.kind!=='trial'||typeof x.restricted!=='boolean')return false;
 if(x.restricted)return x.phase===null||['preparing','defense','voting','first-result','final-defense','completed','interrupted'].includes(String(x.phase));
 if(x.phase==='interrupted')return true;
 return ['preparing','defense','voting','first-result','final-defense','completed'].includes(String(x.phase))&&typeof x.caseText==='string'&&typeof x.penaltyText==='string'&&integer(x.durationSeconds)&&typeof x.defendantMembershipId==='string'&&['pending','accepted','rejected'].includes(String(x.consent))&&[1,2].includes(Number(x.roundNumber))&&(x.deadline===null||integer(x.deadline))&&integer(x.submittedCount)&&record(x.self)&&typeof x.self.voted==='boolean'&&typeof x.self.isDefendant==='boolean'&&Array.isArray(x.defenses)&&x.defenses.every(d=>record(d)&&[1,2].includes(Number(d.number))&&['submitted','skipped'].includes(String(d.status))&&typeof d.text==='string')&&Array.isArray(x.rounds)&&x.rounds.every(r=>record(r)&&[1,2].includes(Number(r.number))&&record(r.counts)&&integer(r.counts.guilty)&&integer(r.counts.notGuilty)&&integer(r.counts.abstain)&&Array.isArray(r.reasons)&&r.reasons.every(a=>record(a)&&['guilty','not-guilty','abstain'].includes(String(a.choice))&&typeof a.reason==='string'))&&(x.outcome===null||['guilty','not-guilty','no-verdict','tie'].includes(String(x.outcome)));
}
export function validMenuProjection(x:unknown):x is MenuProjection{
 return record(x)&&x.kind==='menu'&&['draft','collecting','completed','incomplete'].includes(String(x.phase))&&record(x.self)&&typeof x.self.eligible==='boolean'&&(x.self.submission===null||(record(x.self.submission)&&(x.self.submission.kind==='pass'||(x.self.submission.kind==='candidate'&&typeof x.self.submission.menu==='string'))))&&(x.result===null||(record(x.result)&&(x.result.outcome==='no-choice'||(x.result.outcome==='selected'&&typeof x.result.menu==='string'))));
}
