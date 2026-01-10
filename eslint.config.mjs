import minecraftLinting from 'eslint-plugin-minecraft-linting';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['scripts/**/*.ts'],
    ignores: ['scripts/**/*.test.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'minecraft-linting': minecraftLinting,
    },
    rules: {
      'minecraft-linting/avoid-unnecessary-command': 'warn',
    },
  },
];
