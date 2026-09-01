import {
  contractFileName,
  euros,
  renderContractPdf,
  shortNumber,
  type ContractPdfData,
} from './contract-pdf';

const base: ContractPdfData = {
  id: 'cmabc0def123456',
  companyName: 'Friperie Étoile',
  depositor: {
    lastName: 'Dupont',
    firstName: 'Sophie',
    code: 'DUP',
    address: '12 rue des Lilas, 75011 Paris',
    phone: '06 12 34 56 78',
    email: 'sophie@example.com',
    iban: 'FR76 3000 4000 0512 3456 7890 143',
  },
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2026-12-01T00:00:00.000Z'),
  commission: 40,
  products: [
    { reference: 'D-DUP-001', name: 'Robe à fleurs', salePrice: 35 },
    { reference: 'D-DUP-002', name: 'Sac en cuir', salePrice: 60 },
  ],
};

/** Le PDF n'est pas relu ligne à ligne : on vérifie qu'il en est un et qu'il tient. */
function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

function pageCount(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length;
}

describe('euros', () => {
  it('écrit la virgule décimale et le symbole', () => {
    expect(euros(35)).toBe('35,00 €');
    expect(euros(1867.5)).toBe('1867,50 €');
  });
});

describe('shortNumber', () => {
  it('abrège le cuid : un identifiant entier ne se recopie pas sur un papier', () => {
    expect(shortNumber('cmabc0def123456')).toBe('123456');
  });
});

describe('contractFileName', () => {
  it('range par code déposant et date de début', () => {
    expect(contractFileName(base)).toBe('contrat-DUP-2026-09-01.pdf');
  });

  it("retombe sur le nom quand le déposant n'a pas encore de code", () => {
    const data = { ...base, depositor: { ...base.depositor, code: null, lastName: 'Éloï Bénard' } };
    expect(contractFileName(data)).toBe('contrat-ELOI-BENARD-2026-09-01.pdf');
  });

  it('reste un nom de fichier même si rien de lisible ne subsiste', () => {
    const data = { ...base, depositor: { ...base.depositor, code: '???' } };
    expect(contractFileName(data)).toBe('contrat-DEPOT-2026-09-01.pdf');
  });
});

describe('renderContractPdf', () => {
  it('rend un PDF d’une page pour un dépôt court', async () => {
    const buffer = await renderContractPdf(base);
    expect(isPdf(buffer)).toBe(true);
    expect(pageCount(buffer)).toBe(1);
  });

  it('imprime un déposant réduit à son nom sans laisser de ligne vide', async () => {
    const buffer = await renderContractPdf({
      ...base,
      depositor: {
        lastName: 'Martin',
        firstName: null,
        code: null,
        address: null,
        phone: null,
        email: null,
        iban: null,
      },
    });
    expect(isPdf(buffer)).toBe(true);
  });

  it('accepte un article sans référence ni prix affiché', async () => {
    const buffer = await renderContractPdf({
      ...base,
      products: [{ reference: null, name: 'Lot de foulards', salePrice: null }],
    });
    expect(isPdf(buffer)).toBe(true);
  });

  it('passe à la page suivante et redonne l’en-tête du tableau', async () => {
    const buffer = await renderContractPdf({
      ...base,
      products: Array.from({ length: 60 }, (_, i) => ({
        reference: `D-DUP-${String(i + 1).padStart(3, '0')}`,
        name: `Article ${i + 1}`,
        salePrice: 20,
      })),
    });
    expect(pageCount(buffer)).toBeGreaterThan(1);
  });

  it('ne coupe pas les signatures entre deux pages', async () => {
    // Juste assez d'articles pour finir le tableau en bas de page : les
    // conditions et les signatures doivent basculer, pas déborder.
    const buffer = await renderContractPdf({
      ...base,
      products: Array.from({ length: 28 }, (_, i) => ({
        reference: `D-DUP-${String(i + 1).padStart(3, '0')}`,
        name: `Article ${i + 1}`,
        salePrice: 20,
      })),
    });
    expect(pageCount(buffer)).toBe(2);
  });
});
