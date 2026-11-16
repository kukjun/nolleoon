import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const src = resolve(root, 'apps/api/src');
export function forbiddenImports(layer, source, filename = resolve(src, layer, 'example.ts')) {
  const errors = [];
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  for (const ref of [...file.referencedFiles, ...file.typeReferenceDirectives, ...file.libReferenceDirectives]) {
    errors.push(`${layer}: 삼중 슬래시 참조 금지 (${ref.fileName})`);
  }
  function check(specifier) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) {
      errors.push('정적 문자열이 아닌 의존성은 검토가 필요합니다.');
      return;
    }
    const name = specifier.text;
    const target = relative(src, resolve(dirname(filename), name)).split('/')[0];
    const allowed = layer === 'domain' ? ['domain'] : ['domain', 'application'];
    if (!name.startsWith('.') || !allowed.includes(target)) errors.push(`${layer}: ${name}`);
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) check(node.moduleSpecifier);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) check(node.arguments[0]);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) check(node.moduleReference.expression);
    if (ts.isImportTypeNode(node)) check(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return errors;
}
export function checkLayers() {
  const errors = [];
  function walk(dir, layer) {
    for (const entry of readdirSync(dir, { withFileTypes:true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path, layer);
      else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) errors.push(...forbiddenImports(layer, readFileSync(path,'utf8'), path));
    }
  }
  for (const layer of ['domain', 'application']) walk(resolve(src, layer), layer);
  return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = checkLayers();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
  else console.log('계층 의존성 검사 통과');
}
