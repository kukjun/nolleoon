import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const file of ['AGENTS.md', 'docs/product.md', 'docs/harness.md', 'docs/tasks/TEMPLATE.md']) {
  if (!existsSync(file) || !readFileSync(file, 'utf8').trim()) throw new Error(`Missing context: ${file}`);
}
const diff = spawnSync('git', ['diff', '--check'], { encoding: 'utf8' });
if (diff.status !== 0) throw new Error('git diff --check failed: ' + diff.stdout + diff.stderr);
console.log('Context files present; working diff has no whitespace errors. Content quality requires review.');
