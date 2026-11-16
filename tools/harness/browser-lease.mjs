import {setInterval,clearInterval} from "node:timers";

import {existsSync} from 'node:fs';
// Playwright의 별도 프로세스 그룹 서버도 해당 실행의 하네스 종료에 맞춰 닫는다.
export function watchBrowserLease(path,onExpired,ownerPid){
 if(!path)return ()=>{};
 const ownerAlive=()=>{if(!ownerPid)return true;try{process.kill(Number(ownerPid),0);return true;}catch(error){return error.code!=='ESRCH';}};
 const timer=setInterval(()=>{if(!existsSync(path)||!ownerAlive()){clearInterval(timer);void onExpired();}},100);
 timer.unref();return ()=>clearInterval(timer);
}
