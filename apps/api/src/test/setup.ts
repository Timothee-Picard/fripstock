// `reflect-metadata` est chargé par main.ts en production ; les tests unitaires
// ne passant pas par le bootstrap, il faut le poser ici pour que les
// décorateurs de class-validator et de Nest s'enregistrent.
import 'reflect-metadata';
