import js from '@eslint/js'
import ts from 'typescript-eslint'
import globals from 'globals'
import hooks from 'eslint-plugin-react-hooks'
export default ts.config(
  {
    ignores: [
      '**/dist/**',
      'apps/web/public/nam/**',
      '.local/**',
      'test-results/**',
      'node_modules/**',
      '.npm-cache/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': hooks },
    rules: { ...hooks.configs.recommended.rules },
  },
)
