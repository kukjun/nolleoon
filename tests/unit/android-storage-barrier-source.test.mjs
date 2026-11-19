// Source-only guardrails: these tests do NOT compile/execute Android code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../apps/mobile/android/app/src/main/kotlin/com/kukjun/nolleoon/',import.meta.url);
const source=()=>readFileSync(new URL('SecureStorageBarrier.kt',root),'utf8');
test('Android barrier has fixed plugin 11.2 names, no secret reads or caller-selected names',()=>{
 const s=source();for(const name of ['FlutterSecureKeyStorage','FlutterSecureStorageConfiguration','FlutterSecureStorageConfiguration:FlutterSecureStorage','FlutterSecureStorage'])assert.ok(s.includes(`"${name}"`));
 assert.match(s,/call\.arguments != null/);assert.match(s,/getSharedPreferences\(name, Context\.MODE_PRIVATE\)/);
 assert.doesNotMatch(s,/getAll\(|getString\(|getBoolean\(|getLong\(|getInt\(|readAll\(|Log\.|println\(/);
 const marker=s.match(/MARKER_KEY = "([^"]+)"/)?.[1];assert.ok(marker);assert.ok(!marker.includes('VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIHNlY3VyZSBzdG9yYWdlCg'));assert.ok(!marker.endsWith('_BACKUP'));
});
test('Android source uses process-global serial forced-change commits and explicit failure result',()=>{
 const s=source();assert.match(s,/object SecureStorageBarrier/);assert.match(s,/Executors\.newSingleThreadExecutor/);assert.match(s,/UUID\.randomUUID\(\)/);assert.match(s,/sequence\+\+/);assert.match(s,/Long\.MAX_VALUE/);
 assert.match(s,/putString\(MARKER_KEY, marker\)\.commit\(\)/);assert.doesNotMatch(s,/\.apply\(\)/);assert.match(s,/if \(!committed\)/);assert.match(s,/main\.post/);assert.match(s,/result\.success\(true\)/);assert.match(s,/result\.error\("STORAGE_BARRIER_FAILED",/);
});
test('native engine registers and detaches the exact no-arg flush channel',()=>{
 const s=source(),activity=readFileSync(new URL('MainActivity.kt',root),'utf8');assert.match(s,/"nolleoon\/native_secure_storage_barrier"/);assert.match(s,/call\.method != "flush"/);
 assert.match(activity,/override fun configureFlutterEngine/);assert.match(activity,/super\.configureFlutterEngine/);assert.match(activity,/SecureStorageBarrier\.attach\(applicationContext,/);assert.match(activity,/override fun cleanUpFlutterEngine/);assert.match(activity,/setMethodCallHandler\(null\)/);
});
test('barrier namespace assumptions stay pinned to the inspected plugin dependency',()=>{
 const lock=readFileSync(new URL('../../apps/mobile/pubspec.lock',import.meta.url),'utf8');
 const plugin=lock.match(/\n  flutter_secure_storage:\n([\s\S]*?)(?=\n  [a-z_]+:)/)?.[1];
 assert.ok(plugin);assert.match(plugin,/version: "11\.2\.0"/);
});
