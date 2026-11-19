import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('native callback generator rejects malformed/duplicate/foreign credentials and test identity mismatch',()=>{
 const result=spawnSync('python3',['-m','unittest','discover','-s','tools/mobile/tests','-p','test_kakao_config.py'],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 5 tests/);
});
test('Android callbacks are SDK owned and disabled/exported false through the same defines by default',()=>{
 const manifest=read('apps/mobile/android/app/src/main/AndroidManifest.xml');
 assert.match(manifest,/com\.kakao\.sdk\.flutter\.auth\.AuthCodeHandlerActivity/);
 assert.match(manifest,/android:enabled="\$\{kakaoCallbackEnabled\}"/);
 assert.match(manifest,/android:exported="\$\{kakaoCallbackEnabled\}"/);
 assert.match(manifest,/android:host="oauth"/);
 const gradle=read('apps/mobile/android/app/build.gradle.kts');
 assert.match(gradle,/gradleProperty\("dart-defines"\)/);
 assert.match(gradle,/kakaoVerified == "true" && kakaoNativeKey\.isNotEmpty\(\)/);
 assert.match(gradle,/applicationIdSuffix = "\.localprobe"/);
 assert.match(gradle,/applicationId = "com\.kukjun\.nolleoon"/);
});
test('iOS generated plist has explicit input/output dependency and template remains keyless',()=>{
 const project=read('apps/mobile/ios/Runner.xcodeproj/project.pbxproj');
 assert.equal((project.match(/INFOPLIST_FILE = "\$\(DERIVED_FILE_DIR\)\/NolleoonInfo\.plist";/g)||[]).length,3);
 assert.match(project,/outputPaths = \("\$\(DERIVED_FILE_DIR\)\/NolleoonInfo\.plist",\)/);
 assert.match(project,/inputPaths = \("\$\(SRCROOT\)\/Runner\/Info\.plist", "\$\(SRCROOT\)\/Flutter\/kakao_info\.py",\)/);
 assert.doesNotMatch(read('apps/mobile/ios/Runner/Info.plist'),/CFBundleURLSchemes|LSApplicationQueriesSchemes/);
 const generator=read('apps/mobile/ios/Flutter/kakao_info.py');
 assert.match(generator,/\['kakaokompassauth'\]/);assert.doesNotMatch(generator,/kakaolink|kakaoplus/);
});

test('approved package identity stays consistent across native source and test-only guard',()=>{
 const project=read('apps/mobile/ios/Runner.xcodeproj/project.pbxproj');
 assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.kukjun\.nolleoon;/g)||[]).length,3);
 assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.kukjun\.nolleoon\.RunnerTests;/g)||[]).length,3);
 for(const file of ['MainActivity.kt','SecureStorageBarrier.kt']) assert.match(read('apps/mobile/android/app/src/main/kotlin/com/kukjun/nolleoon/'+file),/^package com\.kukjun\.nolleoon/m);
 assert.match(read('apps/mobile/test_targets/loopback_probe_policy.dart'),/bundleId != 'com\.kukjun\.nolleoon\.localprobe'/);
});
