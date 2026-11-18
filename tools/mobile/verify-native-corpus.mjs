// Explicit optional cross-language check, not a production HTTP client.
// Inputs: synthetic corpus produced by native-integrated-journey.test.mjs,
// exact Dart DTO source file from a separately recorded mobile commit, local SDK.
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export function verifyNativeCorpus(dart,models,corpus,{run=spawnSync}={}) {
if(![dart,models,corpus].every(v=>v&&isAbsolute(v)))throw Error('Usage: node verify-native-corpus.mjs /absolute/dart /absolute/wire_models.dart /absolute/synthetic-corpus.json');
const modelBytes=readFileSync(models),corpusBytes=readFileSync(corpus);
const raw=corpusBytes.toString('utf8'),bundle=JSON.parse(raw);
// The pinned DTO is standalone. Refuse dependencies instead of importing mutable
// neighboring sources outside this evidence snapshot. Conservatively reject
// these directive keywords even in comments/strings; this is not a Dart parser.
if(/\b(?:import|export|part)\b/.test(modelBytes.toString('utf8')))throw Error('A standalone DTO source without import/export/part directives is required');
if(bundle.schemaVersion!==1||bundle.provenance!=='synthetic-provider-real-native-http-sqlite'||!Array.isArray(bundle.records)||bundle.records.length<25)throw Error('Synthetic corpus required');
// Full issued bearer/provider and invitation secrets must not be an export field.
function rejectCredentials(value){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(/^(token|accessToken|refreshToken|authorization|cookie|inviteToken)$/i.test(key))throw Error('Credential field in corpus');rejectCredentials(child);}}
rejectCredentials(bundle);
const directory=mkdtempSync(join(tmpdir(),'native-dart-wire-'));
try{
 const script=join(directory,'verify.dart'),frozenCorpus=join(directory,'corpus.json');
 writeFileSync(join(directory,'wire_models.dart'),modelBytes,{flag:'wx',mode:0o600});
 writeFileSync(frozenCorpus,corpusBytes,{flag:'wx',mode:0o600});
 writeFileSync(script,`import 'dart:convert';\nimport 'dart:io';\nimport 'wire_models.dart';\n
void main(List<String> args) {
 final records=(jsonDecode(File(args.single).readAsStringSync()) as Map)['records'] as List;
 var parsed=0, negative=0;
 for(final record in records) {
  final value=record['value'];
  switch(record['kind']) {
   case 'nativeSession': NativeSessionDto.fromJson(value);
   case 'room': RoomDto.fromJson(value);
   case 'invitePreview': InvitePreviewDto.fromJson(value);
   case 'run': RunDto.fromJson(value);
   case 'runPage': RunPageDto.fromJson(value);
   default: throw FormatException('Unknown corpus kind');
  }
  parsed++;
  if(record['kind']=='run') {
   final mutated=Map<String,Object?>.from(value as Map);
   mutated['forbiddenPrivateField']='synthetic';
   var rejected=false;
   try {RunDto.fromJson(mutated);} on FormatException {rejected=true;}
   if(!rejected)throw StateError('DTO negative control accepted unknown field');
   negative++;
  }
 }
 if(negative==0)throw StateError('Missing run controls');
 stdout.writeln(jsonEncode({'parsed':parsed,'negativeControls':negative}));
}
`,{flag:'wx',mode:0o600});
 const result=run(dart,[script,frozenCorpus],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 if(result.status!==0){process.stderr.write(result.stderr??'');throw Error('Actual Dart DTO decode failed');}
 const counts=JSON.parse(result.stdout.trim());
 if(counts.parsed!==bundle.records.length||!Number.isInteger(counts.negativeControls)||counts.negativeControls<1)throw Error('Invalid decoder evidence');
 const sha=value=>createHash('sha256').update(value).digest('hex');
 return {status:'passed',...counts,modelsSha256:sha(modelBytes),corpusSha256:sha(corpusBytes),scope:'Synthetic real-native HTTP responses decoded by actual Dart DTO source; not SDK, device or real-provider E2E'};
}finally{rmSync(directory,{recursive:true,force:true});}

}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
 if(process.argv.length!==5)throw Error('Three absolute input paths required');
 console.log(JSON.stringify(verifyNativeCorpus(...process.argv.slice(2))));
}
