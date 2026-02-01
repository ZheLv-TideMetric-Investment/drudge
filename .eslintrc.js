module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-case-declarations': 'off',
    'no-undef': 'off',
  },
  overrides: [
    {
      files: ['**/cli/**/*.ts', '**/cli/**/*.js', '**/cli-entry.ts', '**/cli-entry.js'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
