import type {NativeKakaoTokenVerifier} from '../../application/ports/native-kakao-verifier.js';
export interface NativeKakaoConfiguration {expectedAppId:number}
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
export function nativeKakaoConfiguration(env:Record<string,string|undefined>):NativeKakaoConfiguration|undefined {
 const value=env.KAKAO_APP_ID;if(value===undefined)return undefined;
 if(!/^[1-9][0-9]*$/.test(value)||!positive(Number(value)))throw new Error('카카오 앱 검증 설정이 유효하지 않습니다.');
 return{expectedAppId:Number(value)};
}
/** Standalone transport only: no account/session/HTTP endpoint changes in this adapter. */
export class KakaoNativeTokenVerifier implements NativeKakaoTokenVerifier {
 private readonly expectedAppId:number;
 constructor(config:NativeKakaoConfiguration,private readonly fetcher:typeof fetch=fetch){
  if(!config||!positive(config.expectedAppId))throw new Error('카카오 앱 검증 설정이 유효하지 않습니다.');
  this.expectedAppId=config.expectedAppId;
 }
 async verify(accessToken:string):Promise<{subject:string;expiresInSeconds:number}>{
  let timer:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();
  try{
   if(typeof accessToken!=='string'||accessToken.length<1||accessToken.length>8192||/[\s\p{Cc}\p{Cf}]/u.test(accessToken))throw new Error();
   const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error());},5000);});
   const request=async()=>{
    const response=await this.fetcher('https://kapi.kakao.com/v1/user/access_token_info',{method:'GET',redirect:'error',signal:controller.signal,headers:{Authorization:`Bearer ${accessToken}`}});
    if(response.status!==200||response.redirected||!response.body)throw new Error();
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    const cancel=()=>{void reader.cancel().catch(()=>undefined);};controller.signal.addEventListener('abort',cancel,{once:true});
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw new Error();chunks.push(value);}}
    finally{controller.signal.removeEventListener('abort',cancel);cancel();reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();
    const b=body as Record<string,unknown>;
    if(!positive(b.id)||!positive(b.app_id)||b.app_id!==this.expectedAppId||!positive(b.expires_in))throw new Error();
    return{subject:String(b.id),expiresInSeconds:b.expires_in};
   };
   return await Promise.race([request(),deadline]);
  }catch{throw new Error('카카오 토큰을 확인할 수 없습니다.');}
  finally{if(timer!==undefined)clearTimeout(timer);controller.abort();}
 }
}
