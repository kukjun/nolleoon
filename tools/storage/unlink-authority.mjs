import {DurableKakaoUnlinkOutbox,initializeUnlinkOutbox} from '../../apps/api/dist/infrastructure/auth/kakao-unlink-outbox.js';
const [command,pending,journal,checkpoint,...extra]=process.argv.slice(2);
try{
 if(extra.length||!pending||!journal||!checkpoint||!['initialize-empty','health'].includes(command))throw Error('ARGS');
 if(command==='initialize-empty'){
  initializeUnlinkOutbox(pending,journal,checkpoint);console.log('EMPTY_UNLINK_AUTHORITY_INITIALIZED');
 }else{
  const queue=new DurableKakaoUnlinkOutbox(pending,journal,checkpoint);
  console.log(JSON.stringify({status:'available',...queue.health(Date.now()),independentFreshnessVerified:false}));
 }
}catch{console.error('UNLINK_AUTHORITY_FAILED: 명시 경로·현재 원장·잠금을 확인하세요. 자동 초기화/복원은 하지 않습니다.');process.exitCode=1;}
