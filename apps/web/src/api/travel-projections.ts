import {record} from './travel-client.ts';
import type {TrialProjection} from '../travel-trial-panel.tsx';
import type {MenuProjection} from '../travel-menu-panel.tsx';
const integer=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
export function validTrialProjection(x:unknown):x is TrialProjection{
 if(!record(x)||x.kind!=='trial'||typeof x.restricted!=='boolean')return false;
 if(x.restricted)return x.phase===null||(typeof x.phase==='string'&&['preparing','defense','voting','first-result','final-defense','completed','interrupted'].includes(x.phase));
 if(x.phase==='interrupted')return true;
 return (typeof x.phase==='string'&&['preparing','defense','voting','first-result','final-defense','completed'].includes(x.phase))&&typeof x.caseText==='string'&&typeof x.penaltyText==='string'&&integer(x.durationSeconds)&&typeof x.defendantMembershipId==='string'&&(typeof x.consent==='string'&&['pending','accepted','rejected'].includes(x.consent))&&(typeof x.roundNumber==='number'&&[1,2].includes(x.roundNumber))&&(x.deadline===null||integer(x.deadline))&&integer(x.submittedCount)&&record(x.self)&&typeof x.self.voted==='boolean'&&typeof x.self.isDefendant==='boolean'&&Array.isArray(x.defenses)&&x.defenses.every(d=>record(d)&&(typeof d.number==='number'&&[1,2].includes(d.number))&&(typeof d.status==='string'&&['submitted','skipped'].includes(d.status))&&typeof d.text==='string')&&Array.isArray(x.rounds)&&x.rounds.every(r=>record(r)&&(typeof r.number==='number'&&[1,2].includes(r.number))&&record(r.counts)&&integer(r.counts.guilty)&&integer(r.counts.notGuilty)&&integer(r.counts.abstain)&&Array.isArray(r.reasons)&&r.reasons.every(a=>record(a)&&(typeof a.choice==='string'&&['guilty','not-guilty','abstain'].includes(a.choice))&&typeof a.reason==='string'))&&(x.outcome===null||(typeof x.outcome==='string'&&['guilty','not-guilty','no-verdict','tie'].includes(x.outcome)));
}
export function validMenuProjection(x:unknown):x is MenuProjection{
 return record(x)&&x.kind==='menu'&&(typeof x.phase==='string'&&['draft','collecting','completed','incomplete'].includes(x.phase))&&record(x.self)&&typeof x.self.eligible==='boolean'&&(x.self.submission===null||(record(x.self.submission)&&(x.self.submission.kind==='pass'||(x.self.submission.kind==='candidate'&&typeof x.self.submission.menu==='string'))))&&(x.result===null||(record(x.result)&&(x.result.outcome==='no-choice'||(x.result.outcome==='selected'&&typeof x.result.menu==='string'))));
}
