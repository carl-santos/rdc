import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Config pragmática: prioriza pegar bugs (rules-of-hooks, no-undef) sem explodir
// em ruído no código existente (que usa `as any` extensivamente). Regras
// estilísticas/ruidosas ficam como 'warn' ou 'off' — podem ser endurecidas depois.
export default tseslint.config(
    {
        ignores: [
            'dist',
            'node_modules',
            '_stitches',
            'supabase/functions', // Deno — runtime/globals diferentes
            '*.config.{js,ts}',
            'loadtests',
        ],
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        linterOptions: {
            // Diretivas eslint-disable não usadas viram aviso, não erro (não bloqueia CI).
            reportUnusedDisableDirectives: 'warn',
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            // Apenas as regras clássicas de hooks (pegam bugs reais). NÃO usamos o
            // preset recommended do react-hooks v7 — ele liga as regras do React
            // Compiler (setState em effect, etc.), ruidosas demais p/ este código.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            // Codebase usa `as any` deliberadamente em muitos pontos (Supabase types).
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-useless-assignment': 'off', // falsos positivos no padrão default-then-override
            'prefer-const': 'warn',
        },
    },
    {
        // Testes: relaxa regras que não fazem sentido em specs.
        files: ['src/**/*.{test,spec}.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
);
