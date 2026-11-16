import { readdirSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export function discoverTests(root, directory) {
  const base=realpathSync(root);
  const target=realpathSync(resolve(base,directory));
  const location=relative(base,target);
  if(location.startsWith('..') || isAbsolute(location)) throw new Error('시험 경로는 저장소 내부여야 합니다.');
  const files=[];
  function visit(dir) {
    for(const entry of readdirSync(dir,{withFileTypes:true})) {
      const path=resolve(dir,entry.name);
      if(entry.isSymbolicLink()) throw new Error('시험 탐색에서 심볼릭 링크는 허용하지 않습니다.');
      if(entry.isDirectory()) visit(path);
      else if(entry.isFile() && entry.name.endsWith('.test.mjs')) files.push(relative(base,path).split('\\').join('/'));
    }
  }
  visit(target);
  if(!files.length) throw new Error(`실행할 시험이 없습니다: ${directory}`);
  return files.sort();
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const allowed=['tests/harness','tests/workspace','tests/unit','tests/integration'];
    const directory=process.argv[2];
    if(!allowed.includes(directory)) throw new Error('허용되지 않은 시험 그룹입니다.');
    const root=resolve(import.meta.dirname,'../..');
    const env={...process.env}; delete env.NODE_TEST_CONTEXT;
    const result=spawnSync(process.execPath,['--test',...discoverTests(root,directory)],{cwd:root,stdio:'inherit',env});
    if(result.error) throw result.error;
    process.exitCode=result.status??1;
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
