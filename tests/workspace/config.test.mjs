import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('앱 workspace와 공유 계약이 있다', () => {
 for (const dir of ['apps/api', 'apps/web', 'packages/contracts']) assert.ok(JSON.parse(readFileSync(`${dir}/package.json`)).name);
});
test('환경 누락·잘못된 포트·외부 바인딩을 거절한다', async () => {
 const { parseEnvironment } = await import('../../apps/api/src/config/environment.mjs');
 for (const env of [{}, {API_PORT:''}, {API_PORT:'3.5'}, {API_PORT:'3001', API_HOST:''}, {API_PORT:'x'}, {API_PORT:'0'}, {API_PORT:'65536'}, {API_PORT:'3001', API_HOST:'0.0.0.0'}]) assert.throws(() => parseEnvironment(env));
 assert.deepEqual(parseEnvironment({API_PORT:'3001'}), {port:3001, host:'127.0.0.1'});
});
test('계층 검사기는 프레임워크·DB·역방향 import를 탐지한다', async () => {
 const { forbiddenImports } = await import('../../tools/workspace/layers.mjs');
 for (const source of ["import { Injectable } from '@nestjs/common'", "export * from '../infrastructure/db'", "const db = require('better-sqlite3')", "import('../presentation/bff')", "import x from '../application/example'"]) assert.ok(forbiddenImports('domain', source).length);
 assert.deepEqual(forbiddenImports('application', "import type { Health } from '../domain/health.js'"), []);
});

test('실제 domain/application 파일 의존성이 안쪽을 향한다', async () => {
 const { checkLayers } = await import('../../tools/workspace/layers.mjs');
 assert.deepEqual(checkLayers(), []);
});
test('타입 import와 삼중 슬래시 참조도 계층 경계를 지킨다', async () => {
 const { forbiddenImports } = await import('../../tools/workspace/layers.mjs');
 assert.ok(forbiddenImports('domain', "type Foo = import('@nestjs/common').Injectable;").length);
 assert.ok(forbiddenImports('application', "type Foo = import('../presentation/health.controller.js').HealthController;").length);
 assert.deepEqual(forbiddenImports('application', "type Status = import('../domain/health.js').ServiceStatus;"), []);
 assert.ok(forbiddenImports('domain', '/// <reference types="node" />').length);
 assert.ok(forbiddenImports('domain', '/// <reference path="../presentation/health.controller.ts" />').length);
});
