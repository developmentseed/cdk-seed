module.exports = {
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: [
    'jest',
  ],
  env: {
    'jest/globals': true,
  },
  'import/parsers': {
    '@typescript-eslint/parser': ['.ts', '.tsx'],
  },
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: [
        '@typescript-eslint',
      ],
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      extends: ['airbnb-typescript/lib/shared'],
    },
  ],
};
