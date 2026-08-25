/**
 * Convention de commit du dépôt — voir la section "Commits, versions et
 * vérifications" de CLAUDE.md.
 *
 * Appliquée par le hook .githooks/commit-msg en local, et par le job `commits`
 * de la CI sur les pull requests (qui rattrape les commits poussés avec
 * --no-verify).
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Une seule ligne de sujet, 72 caractères en-tête compris.
    'header-max-length': [2, 'always', 72],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    // Le corps reste facultatif, mais s'il existe il doit être séparé du sujet
    // par une ligne vide, sinon git le colle au sujet.
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
    // Scope facultatif : un scope hors liste avertit, mais ne bloque pas —
    // sinon la liste devient un frein dès qu'un module nouveau apparaît.
    'scope-enum': [
      1,
      'always',
      [
        'api',
        'web',
        'db',
        'docker',
        'ci',
        'deps',
        'auth',
        'catalogue',
        'produits',
        'depots',
        'stats',
      ],
    ],
  },
};
