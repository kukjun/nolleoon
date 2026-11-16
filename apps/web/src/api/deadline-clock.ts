export function remainingSeconds(deadline:number,serverNow:number,anchor:number,now:number){return Math.ceil(Math.max(0,deadline-serverNow-Math.max(0,now-anchor))/1000);}
