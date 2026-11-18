import {existsSync,lstatSync,readdirSync,readFileSync,realpathSync} from 'node:fs';
import {basename,dirname,extname,isAbsolute,join,relative,sep} from 'node:path';
import type {Request,Response,NextFunction} from 'express';
const types:Record<string,string>={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
function within(root:string,path:string){const rel=relative(root,path);return rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!isAbsolute(rel));}
/** Immutable startup snapshot: never resolve user-supplied paths at request time. */
export function staticWeb(webRoot:string,dbPath:string){
 if(!isAbsolute(webRoot)||lstatSync(webRoot).isSymbolicLink())throw new Error('Invalid web build');
 const root=realpathSync(webRoot);
 const database=existsSync(dbPath)?realpathSync(dbPath):join(realpathSync(dirname(dbPath)),basename(dbPath));
 if(within(root,database))throw new Error('Database overlaps web build');
 const files=new Map<string,{bytes:Buffer;type:string}>();
 function walk(directory:string,prefix:string){
  for(const name of readdirSync(directory)){
   const path=join(directory,name),key=`${prefix}/${name}`,stat=lstatSync(path);
   if(stat.isSymbolicLink()||name.startsWith('.'))throw new Error('Unsafe web build');
   if(stat.isDirectory()){if(key!=='/assets')throw new Error('Unexpected web directory');walk(path,key);continue;}
   if(!stat.isFile()||!(key==='/index.html'||(/^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(key)&&types[extname(name)])))throw new Error('Unexpected web file');
   files.set(key,{bytes:readFileSync(path),type:key==='/index.html'?'text/html; charset=utf-8':types[extname(name)]!});
  }
 }
 walk(root,'');
 const index=files.get('/index.html');
 if(!index||!index.bytes.toString().includes('<div id="root">')||!Array.from(files.keys()).some(key=>key.endsWith('.js')))throw new Error('Missing web build');
 return (request:Request,response:Response,next:NextFunction)=>{
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  const path=request.url.split('?')[0]!;
  if(path==='/api'||path.startsWith('/api/')){next();return;}
  const travelRoute=/^\/travel\/?$/.test(path)||/^\/travel\/(rooms|invite)\/[A-Za-z0-9_-]{1,128}$/.test(path);
  const file=files.get(path==='/'||travelRoute?'/index.html':path);
  if(!file||!['GET','HEAD'].includes(request.method)){response.status(404).json({code:'NOT_FOUND',message:'찾을 수 없습니다.'});return;}
  if(path.startsWith('/assets/'))response.setHeader('Cache-Control','public, max-age=31536000, immutable');
  response.setHeader('Content-Type',file.type);response.status(200).send(request.method==='HEAD'?undefined:file.bytes);
 };
}
