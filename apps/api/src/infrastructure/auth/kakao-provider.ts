import type {KakaoIdentityProvider} from '../../application/ports/account-auth.js';
const unsafe=(s:string)=>/\s/.test(s)||[...s].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127);
export interface KakaoConfiguration {clientId:string;clientSecret:string;redirectUri:string}
export function kakaoConfiguration(env:Record<string,string|undefined>,origin:string):KakaoConfiguration|undefined {
 const fields=[env.KAKAO_CLIENT_ID,env.KAKAO_CLIENT_SECRET,env.KAKAO_REDIRECT_URI];
 if(fields.every(v=>v===undefined))return undefined;
 if(fields.some(v=>!v||v.length>2048||unsafe(v)))throw new Error('카카오 로그인 설정이 유효하지 않습니다.');
 const uri=new URL(env.KAKAO_REDIRECT_URI!);const publicUrl=new URL(origin);
 if(uri.href!==`${publicUrl.origin}/api/account/callback`||publicUrl.origin!==origin||!['https:','http:'].includes(publicUrl.protocol)||(publicUrl.protocol==='http:'&&!['127.0.0.1','localhost'].includes(publicUrl.hostname)))throw new Error('카카오 로그인 설정이 유효하지 않습니다.');
 return {clientId:env.KAKAO_CLIENT_ID!,clientSecret:env.KAKAO_CLIENT_SECRET!,redirectUri:uri.href};
}
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
async function boundedJson(response:Response):Promise<Record<string,unknown>> {
 if(!response.ok||response.redirected||!response.body)throw new Error('인증 제공자 응답을 확인할 수 없습니다.');
 const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw new Error('인증 제공자 응답을 확인할 수 없습니다.');chunks.push(value);}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
 const value:unknown=JSON.parse(new TextDecoder().decode(all));if(!object(value))throw new Error('인증 제공자 응답을 확인할 수 없습니다.');return value;
}
export class KakaoProvider implements KakaoIdentityProvider {
 constructor(private readonly config:KakaoConfiguration,private readonly fetcher:typeof fetch=fetch){}
 authorizationUrl(state:string){const url=new URL('https://kauth.kakao.com/oauth/authorize');url.search=new URLSearchParams({response_type:'code',client_id:this.config.clientId,redirect_uri:this.config.redirectUri,state}).toString();return url.href;}
 async exchange(code:string):Promise<{subject:string}>{
  try{
   const signal=AbortSignal.timeout(5000);
   const tokens=await boundedJson(await this.fetcher('https://kauth.kakao.com/oauth/token',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},body:new URLSearchParams({grant_type:'authorization_code',client_id:this.config.clientId,client_secret:this.config.clientSecret,redirect_uri:this.config.redirectUri,code})}));
   if(typeof tokens.access_token!=='string'||!tokens.access_token||tokens.access_token.length>8192||unsafe(tokens.access_token)||typeof tokens.token_type!=='string'||tokens.token_type.toLowerCase()!=='bearer'||typeof tokens.expires_in!=='number'||!Number.isFinite(tokens.expires_in)||tokens.expires_in<=0)throw new Error();
   // Read only the stable provider subject. Profile/email/friends/photo fields are discarded.
   const user=await boundedJson(await this.fetcher('https://kapi.kakao.com/v2/user/me',{method:'POST',redirect:'error',signal,headers:{Authorization:`Bearer ${tokens.access_token}`,'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},body:new URLSearchParams({property_keys:'[]'})}));
   if(typeof user.id!=='number'||!Number.isSafeInteger(user.id)||user.id<=0)throw new Error();
   return {subject:String(user.id)};
  }catch{throw new Error('인증 제공자 응답을 확인할 수 없습니다.');}
 }
}
