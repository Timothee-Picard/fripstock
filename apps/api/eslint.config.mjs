// @ts-check
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist', 'src/generated'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Le formatage n'est PAS géré par ESLint : c'est `make check-format` qui s'en
  // charge, avec le .prettierrc de la racine. Faire tourner Prettier comme
  // règle ESLint échouerait ici — le conteneur api ne monte que apps/api, il ne
  // voit donc pas le .prettierrc de la racine et retomberait sur les défauts,
  // réécrivant le code à l'inverse de ce que veut le dépôt.
  // eslint-config-prettier se contente de désactiver les règles qui
  // entreraient en conflit avec Prettier.
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
);
