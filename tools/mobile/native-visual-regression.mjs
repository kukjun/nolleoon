/** Opt-in proposed visual gate. Never updates the baseline or contacts an API. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
export const stages=['00-auth','01-home','02-lobby','03-selection','04-team-ready','05-team-result'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function environment(sdk){
 const v=JSON.parse(readFileSync(join(sdk,'bin/cache/flutter.version.json')));
 return {platform:process.platform,arch:process.arch,renderer:'flutter-test-RepaintBoundary',viewport:{width:390,height:844,pixelRatio:1},fontPolicy:'system-Korean-missing-family-fallback-v1-public-presets-decoded',fontSha256:hash(readFileSync('/System/Library/Fonts/AppleSDGothicNeo.ttc')),iconSha256:hash(readFileSync(join(sdk,'bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf'))),frameworkRevision:v.frameworkRevision,engineRevision:v.engineRevision,dartVersion:v.dartSdkVersion};
}
function git(args){const result=spawnSync('git',args,{encoding:'utf8'});if(result.status!==0)throw Error('Git capture provenance unavailable');return result.stdout.trim();}
export function sourceSnapshot(){
 const paths=git(['ls-files','--cached','--others','--exclude-standard','apps/mobile','tools/mobile/native-visual-regression.mjs']).split('\n').filter(Boolean).sort();
 const digest=createHash('sha256');for(const path of paths){digest.update(path+'\0');digest.update(readFileSync(path));digest.update('\0');}
 return {commit:git(['rev-parse','HEAD']),dirty:git(['status','--porcelain']).length>0,sourceDigest:digest.digest('hex')};
}
export function assertStableCapture(before,after){if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Source or environment changed during capture; evidence rejected');}
export function capture(output,sdk){
 if(existsSync(output))throw Error('Output must be new');
 const startedAt=new Date().toISOString();
 const before={source:sourceSnapshot(),environment:environment(sdk)};
 const result=spawnSync(join(sdk,'bin/flutter'),['--suppress-analytics','test','--no-pub','test_targets/style_evidence_capture.dart'],{cwd:resolve('apps/mobile'),env:{...process.env,STYLE_EVIDENCE_OUTPUT_DIR:resolve(output),STYLE_EVIDENCE_ICON_FONT:join(sdk,'bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf')},stdio:'inherit'});
 if(result.status!==0)throw Error('Capture failed');
 const after={source:sourceSnapshot(),environment:environment(sdk)};assertStableCapture(before,after);
 const images=Object.fromEntries(stages.map(stage=>[stage,hash(readFileSync(join(output,stage+'.png')))]));
 writeFileSync(join(output,'manifest.json'),JSON.stringify({environment:before.environment,source:before.source,startedAt,finishedAt:new Date().toISOString(),stableDuringCapture:true,images},null,2),{flag:'wx'});
}
export async function compare(baseline,candidate,output){
 mkdirSync(output); // Refuse overwrite including prior diff evidence.
 const base=JSON.parse(readFileSync(join(baseline,'manifest.json'))),current=JSON.parse(readFileSync(join(candidate,'manifest.json')));
 if(!base.environment||!current.environment||!base.images||stages.some(stage=>!/^[a-f0-9]{64}$/.test(base.images[stage]??'')))throw Error('Missing visual evidence manifest');
 for(const e of [base.environment,current.environment])if(!e.fontSha256||!e.iconSha256||!e.engineRevision||!e.frameworkRevision||!e.dartVersion||e.viewport?.width!==390||e.viewport?.height!==844||e.viewport?.pixelRatio!==1||e.renderer!=='flutter-test-RepaintBoundary'||!e.platform||!e.arch||!e.fontPolicy)throw Error('Incomplete environment manifest');
 const report={baselineStatus:'proposed-not-user-approved',acceptance:false,status:'blocked',environmentMatches:JSON.stringify(base.environment)===JSON.stringify(current.environment),scenes:[]};
 const finish=()=>{writeFileSync(join(output,'summary.json'),JSON.stringify(report,null,2),{flag:'wx'});return report;};
 if(!report.environmentMatches){report.reason='Font/SDK/platform/renderer manifest mismatch; review environment, do not refresh baseline automatically';return finish();}
 const browser=await chromium.launch();
 try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  for(const stage of stages){
   const b=readFileSync(join(baseline,stage+'.png')),c=readFileSync(join(candidate,stage+'.png'));
   if(base.images?.[stage]!==hash(b))throw Error('Baseline image checksum mismatch');
   if(current.images?.[stage]!==hash(c))throw Error('Candidate image checksum mismatch');
   const diff=await page.evaluate(async([before,after])=>{
    const load=async src=>{const image=new globalThis.Image();image.src=src;await image.decode();if(image.width!==390||image.height!==844)throw Error('Unexpected viewport');const canvas=globalThis.document.createElement('canvas');canvas.width=390;canvas.height=844;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,390,844);};
    const b=await load(before),c=await load(after),canvas=globalThis.document.createElement('canvas');canvas.width=390;canvas.height=844;const ctx=canvas.getContext('2d'),out=ctx.createImageData(390,844);let changedPixels=0;
    for(let i=0;i<b.data.length;i+=4){const different=[0,1,2,3].some(n=>b.data[i+n]!==c.data[i+n]);if(different)changedPixels++;out.data[i]=different?255:Math.round(c.data[i]*0.25);out.data[i+1]=different?0:Math.round(c.data[i+1]*0.25);out.data[i+2]=different?128:Math.round(c.data[i+2]*0.25);out.data[i+3]=255;}
    ctx.putImageData(out,0,0);return{changedPixels,png:canvas.toDataURL('image/png').split(',')[1]};
   },['data:image/png;base64,'+b.toString('base64'),'data:image/png;base64,'+c.toString('base64')]);
   writeFileSync(join(output,stage+'-diff.png'),Buffer.from(diff.png,'base64'),{flag:'wx'});
   report.scenes.push({stage,changedPixels:diff.changedPixels,totalPixels:390*844,candidateSha256:hash(c)});
  }
  report.status=report.scenes.every(x=>x.changedPixels===0)?'unchanged':'changed';return finish();
 }finally{await browser.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [mode,a,b,c]=process.argv.slice(2);
 try{if(mode==='capture'&&a&&b&&!c)capture(resolve(a),resolve(b));else if(mode==='compare'&&a&&b&&c){const report=await compare(resolve(a),resolve(b),resolve(c));console.log(JSON.stringify({status:report.status,acceptance:false}));if(report.status!=='unchanged')process.exitCode=1;}else throw Error('Use capture NEW_DIR FLUTTER_SDK or compare BASELINE CANDIDATE NEW_DIFF_DIR');}catch(error){console.error(error.message);process.exitCode=1;}
}
