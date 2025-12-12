import minecraft from 'eslint-plugin-minecraft-linting/configs/recommended';

export default [
  minecraft,
  {
    files: ['scripts/**/*.ts'],
    ignores: ['scripts/**/*.test.ts'],
  },
];
