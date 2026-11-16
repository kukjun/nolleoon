export class AuthGeneration {
 private generation=0;
 begin(){return ++this.generation;}
 value(){return this.generation;}
 current(generation:number){return generation===this.generation;}
}
export class IdentityLossChannel {
 private generation=0;
 private listener:(()=>void)|undefined;
 subscribe(listener:()=>void){
  const generation=++this.generation;this.listener=listener;
  return()=>{if(generation===this.generation){this.generation++;this.listener=undefined;}};
 }
 capture(){
  const generation=this.generation;const listener=this.listener;
  return()=>{if(listener&&generation===this.generation&&listener===this.listener){this.generation++;this.listener=undefined;listener();}};
 }
}
export const identityLoss=new IdentityLossChannel();
