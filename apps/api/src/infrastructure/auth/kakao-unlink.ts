import type {KakaoUnlink} from '../../application/ports/kakao-unlink.js';
export interface KakaoUnlinkConfiguration {adminKey:string}
const safeKey=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=2048&&!/[\s\p{Cc}\p{Cf}]/u.test(v);
export function kakaoUnlinkConfiguration(env:Record<string,string|undefined>):KakaoUnlinkConfiguration|undefined {
 if(env.KAKAO_ADMIN_KEY===undefined)return undefined;
 if(!safeKey(env.KAKAO_ADMIN_KEY))throw new Error('카카오 연결 해제 설정이 유효하지 않습니다.');
 return{adminKey:env.KAKAO_ADMIN_KEY};
}
/** Deliberately not registered in production or account deletion until retry retention is approved. */
export class KakaoUnlinkProvider implements KakaoUnlink {
 constructor(private readonly config:KakaoUnlinkConfiguration,private readonly fetcher:typeof fetch=fetch){if(!safeKey(config.adminKey))throw new Error('카카오 연결 해제 설정이 유효하지 않습니다.');}
 async unlink(subject:string):Promise<{status:'unlinked'|'already-unlinked'}>{
  try{
   if(typeof subject!=='string'||! /^[1-9][0-9]*$/.test(subject)||!Number.isSafeInteger(Number(subject)))throw new Error();
   const response=await this.fetcher('https://kapi.kakao.com/v1/user/unlink',{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:`KakaoAK ${this.config.adminKey}`,'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},body:new URLSearchParams({target_id_type:'user_id',target_id:subject})});
   if(response.redirected||!response.body||![200,400].includes(response.status))throw new Error();
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw new Error();chunks.push(value);}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const body:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();
   const data=body as Record<string,unknown>;
   if(response.status===400&&data.code===-101)return{status:'already-unlinked'};
   if(response.status!==200||typeof data.id!=='number'||!Number.isSafeInteger(data.id)||String(data.id)!==subject)throw new Error();
   return{status:'unlinked'};
  }catch{throw new Error('카카오 연결 해제를 확인할 수 없습니다.');}
 }
}
