import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    // database.ts is regenerated wholesale by `supabase gen types` (see
    // CLAUDE.md) — lint it like build output, not hand-written code.
    // supabase/functions runs on Deno, a separate runtime/tsconfig from this
    // Vite app — linting it against the app's tsconfig would just error on
    // `Deno.*` globals and jsr: imports it can't resolve.
    ignores: [
      'dist',
      'playwright-report',
      'test-results',
      'docs',
      'src/shared/types/database.ts',
      'supabase/functions/**',
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    // shadcn/ui generates these files (see CLAUDE.md: "don't hand-edit the
    // variant boilerplate"); they intentionally co-export variant helpers
    // (e.g. buttonVariants) and don't follow our stricter type-checked rules.
    files: ['src/shared/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-unnecessary-template-expression': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  eslintConfigPrettier,
)
