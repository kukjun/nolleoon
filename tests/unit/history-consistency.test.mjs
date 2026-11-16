import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestGameHistory} from '../../apps/web/src/api/rooms-client.ts';
import {requestHistoryDetail} from '../../apps/web/src/api/history-client.ts';
const game={publishedRounds:[],settlement:null,ownVote:null,version:0,serverNow:1000,round:null,defense:{roundNumber:1,status:'pending',text:null},gameId:'g',status:'result',caseText:'사건',penaltyText:'벌칙',durationMinutes:3,self:{role:'observer',eligible:false},participantCount:5,voterCount:4};
for(const personal of [false,true])test(`${personal?'개인':'방'} 기록의 안팎 게임 ID와 완료·중단 상태가 일치해야 한다`,async()=>{
 const original=globalThis.fetch;const completed={gameId:'g',game,interrupted:false,interruption:null};const base=personal?{...completed,ongoing:null}:completed;
 const cases=[[base,true],[{...base,game:{...game,gameId:'other'}},false],[{...base,interrupted:true},false],[{...base,interruption:{caseText:'모순'}},false],[{...base,game:null},false],[{...base,game:{...game,status:'voting'}},false],[{...base,game:null,interrupted:true,interruption:{caseText:null}},true]];
 if(personal)cases.push([{...base,ongoing:{caseText:'진행'},game:null},true],[{...base,ongoing:{caseText:'진행'}},false],[{...base,ongoing:{caseText:'진행'},game:null,interrupted:true},false]);
 try{for(const [payload,ok]of cases){globalThis.fetch=async()=>({ok:true,json:async()=>payload});const result=personal?await requestHistoryDetail('g'):await requestGameHistory('r','g');assert.equal(result.ok,ok,JSON.stringify(payload));}}finally{globalThis.fetch=original;}
});
