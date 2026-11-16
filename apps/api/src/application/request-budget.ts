export class RequestBudget {
 private readonly windows=new Map<string,{startedAt:number;count:number}>();
 constructor(private readonly maxKeys=2048){}
 get size(){return this.windows.size;}
 consume(key:string,limit:number,now:number){
  for(const [id,window] of this.windows)if(now-window.startedAt>=60000||now<window.startedAt)this.windows.delete(id);
  const id=this.windows.has(key)||this.windows.size<this.maxKeys?key:'overflow';
  let window=this.windows.get(id);
  if(!window){window={startedAt:now,count:0};this.windows.set(id,window);}
  if(window.count>=limit)return {allowed:false,retryAfter:Math.max(1,Math.ceil((window.startedAt+60000-now)/1000))};
  window.count++;return {allowed:true,retryAfter:0};
 }
}
