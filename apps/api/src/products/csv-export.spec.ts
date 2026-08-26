import { dateFr, frNumber, toCsv, yesNo } from './csv-export';

const BOM = '﻿';

describe('csv-export', () => {
  describe('toCsv', () => {
    it('ouvre par un BOM et sépare par des points-virgules', () => {
      expect(toCsv(['A', 'B'], [['1', '2']])).toBe(`${BOM}A;B\r\n1;2\r\n`);
    });

    it('termine toujours par un retour de ligne, même sans donnée', () => {
      expect(toCsv(['A'], [])).toBe(`${BOM}A\r\n`);
    });

    it('rend une cellule vide pour null et undefined', () => {
      expect(toCsv(['A', 'B'], [[null, undefined]])).toBe(`${BOM}A;B\r\n;\r\n`);
    });

    it('sérialise nombres et booléens sans les altérer', () => {
      expect(toCsv(['A', 'B'], [[12.5, true]])).toBe(`${BOM}A;B\r\n12.5;true\r\n`);
    });

    it('entoure de guillemets une cellule qui contient le séparateur', () => {
      expect(toCsv(['A'], [['un;deux']])).toBe(`${BOM}A\r\n"un;deux"\r\n`);
    });

    it('double les guillemets internes', () => {
      expect(toCsv(['A'], [['dit "bonjour"']])).toBe(`${BOM}A\r\n"dit ""bonjour"""\r\n`);
    });

    it('entoure de guillemets une cellule qui contient un saut de ligne', () => {
      expect(toCsv(['A'], [['deux\nlignes']])).toBe(`${BOM}A\r\n"deux\nlignes"\r\n`);
    });

    it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tonglet'])(
      'neutralise la formule %s en la préfixant',
      (dangereux) => {
        expect(toCsv(['A'], [[dangereux]])).toContain(`'${dangereux}`);
      },
    );

    it("neutralise =HYPERLINK, vecteur d'exfiltration connu", () => {
      const csv = toCsv(['A'], [['=HYPERLINK("http://x","clic")']]);
      expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`);
    });

    it('ne préfixe pas une cellule dont le tiret est au milieu', () => {
      expect(toCsv(['A'], [['a-b']])).toBe(`${BOM}A\r\na-b\r\n`);
    });
  });

  describe('frNumber', () => {
    it('remplace le point décimal par une virgule', () => {
      expect(frNumber('12.50')).toBe('12,50');
      expect(frNumber(12.5)).toBe('12,5');
    });

    it('rend une chaîne vide pour une valeur absente', () => {
      expect(frNumber(null)).toBe('');
      expect(frNumber(undefined)).toBe('');
    });

    it('laisse intact un entier', () => {
      expect(frNumber(12)).toBe('12');
    });
  });

  describe('dateFr', () => {
    it('formate en jour/mois/année', () => {
      expect(dateFr(new Date('2026-08-20T14:30:00.000Z'))).toBe('20/08/2026');
    });

    it('rend une chaîne vide pour une date absente', () => {
      expect(dateFr(null)).toBe('');
    });
  });

  describe('yesNo', () => {
    it('traduit le booléen', () => {
      expect(yesNo(true)).toBe('oui');
      expect(yesNo(false)).toBe('non');
    });

    it('rend une chaîne vide quand la question ne se pose pas', () => {
      expect(yesNo(null)).toBe('');
      expect(yesNo(undefined as unknown as null)).toBe('');
    });
  });
});
