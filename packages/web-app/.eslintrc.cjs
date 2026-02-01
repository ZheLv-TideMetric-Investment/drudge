module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'next/typescript'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-var-requires': 'off',
    'no-unused-vars': 'off',
    'react/no-unescaped-entities': 'off',
  },
};
