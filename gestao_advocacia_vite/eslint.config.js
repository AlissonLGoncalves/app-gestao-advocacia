import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // TODO: voltar para error após tarefa N2/N1 (quebra de componentes e testes frontend)
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(e|err|error)$',
        },
      ],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // ci-greenfield: regras experimentais do react-hooks 7.x (nov/2025) pegaram codigo
      // legado em massa. Rebaixadas para warn ate refactor dedicado em PR proprio.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/setupTests.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
]
