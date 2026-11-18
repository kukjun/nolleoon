import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyNativeCorpus} from '../../tools/mobile/verify-native-corpus.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'native-corpus-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const models=join(dir,'models.dart'),corpus=join(dir,'corpus.json');const source='library;\n// synthetic standalone DTO source\n';const raw=JSON.stringify({schemaVersion:1,provenance:'synthetic-provider-real-native-http-sqlite',records:Array.from({length:25},()=>({kind:'run',value:{}}))});writeFileSync(models,source);writeFileSync(corpus,raw);return {models,corpus,source,raw};}
test('decoder executes frozen private bytes; replacing both original inputs cannot change reported evidence',t=>{
 const f=fixture(t);let snapshotDir;
 const result=verifyNativeCorpus('/synthetic/dart',f.models,f.corpus,{run:(_command,args)=>{
  const script=readFileSync(args[0],'utf8');snapshotDir=args[0].slice(0,args[0].lastIndexOf('/'));
  writeFileSync(f.models,'replaced after initial read');writeFileSync(f.corpus,'replaced after initial read');
  assert.notEqual(args[1],f.corpus);
  const frozenModels=join(snapshotDir,'wire_models.dart');
  assert.equal(readFileSync(frozenModels,'utf8'),f.source);assert.equal(readFileSync(args[1],'utf8'),f.raw);
  assert.equal(statSync(frozenModels).mode&0o777,0o600);assert.equal(statSync(args[1]).mode&0o777,0o600);
  assert.ok(script.includes("import 'wire_models.dart'"));assert.equal(script.includes(f.models),false);
  return {status:0,stdout:JSON.stringify({parsed:25,negativeControls:25})};
 }});
 assert.equal(result.modelsSha256,hash(f.source));assert.equal(result.corpusSha256,hash(f.raw));assert.equal(existsSync(snapshotDir),false);
});
test('relative dependency directives fail closed before execution rather than loading mutable neighbors',t=>{
 const f=fixture(t);let calls=0;
 for(const directive of ["import 'neighbor.dart';","export 'neighbor.dart';","part 'neighbor.dart';", "library; import 'neighbor.dart';", "import /* gap */ 'neighbor.dart';"]){
  writeFileSync(f.models,directive);
  assert.throws(()=>verifyNativeCorpus('/synthetic/dart',f.models,f.corpus,{run:()=>{calls++;}}),/standalone/);
 }
 assert.equal(calls,0);
});
