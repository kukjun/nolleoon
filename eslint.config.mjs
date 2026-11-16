import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default [
 { ignores:['**/dist/**','node_modules/**','artifacts/**','ui/**'] },
 { files:['apps/**/*.ts','apps/**/*.tsx','packages/**/*.ts'], ...js.configs.recommended, languageOptions:{parser:tseslint.parser,parserOptions:{ecmaFeatures:{jsx:true}},globals:{process:'readonly',console:'readonly',document:'readonly'}} },
 ...tseslint.configs.recommended.map(config=>({...config,files:['apps/**/*.ts','apps/**/*.tsx','packages/**/*.ts']})),
 { files:['**/*.mjs'], ...js.configs.recommended, languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:{process:'readonly',console:'readonly',setTimeout:'readonly',clearTimeout:'readonly',fetch:'readonly',AbortSignal:'readonly',URL:'readonly',Buffer:'readonly'}} },
];
