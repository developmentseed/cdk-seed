module.exports = {
  env: {
    'jest/globals': true,
  },
  plugins: [
    '@typescript-eslint',
    'jest',
  ],
  extends: [
    'airbnb-base',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
  ignorePatterns: [
    'packages/*/lib/*.js',
    '*.d.ts',
    'node_modules/',
    '*.generated.ts',
  ],
};
