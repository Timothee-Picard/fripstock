/**
 * Le contrat de dépôt-vente, mis en page pour être imprimé et signé.
 *
 * Un dépôt se signe sur papier : le déposant repart avec la liste de ce qu'il
 * a laissé, et la boutique garde la sienne. C'est ce document-là qui fait foi
 * en cas de désaccord sur ce qui a été confié — d'où la liste des articles
 * avec leur référence, celle-là même qui est collée sur l'étiquette.
 *
 * Rendu côté API et non côté écran : les coordonnées du déposant (IBAN
 * compris) et le contenu du contrat vivent ici, et l'impression du navigateur
 * ne donne ni nom de fichier ni mise en page reproductible.
 */
import PDFDocument from 'pdfkit';
import { SHOP_TIMEZONE } from '../stats/today';

/**
 * Ce que le PDF a besoin de savoir. Volontairement détaché de Prisma : les
 * montants arrivent déjà en nombres, et rien de ce qui n'est pas imprimé n'y
 * figure — un `Decimal` ou une relation de plus dans ce type aurait fini
 * lu à l'aveugle par la mise en page.
 */
export interface ContractPdfData {
  id: string;
  companyName: string;
  depositor: {
    lastName: string;
    firstName: string | null;
    code: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    iban: string | null;
  };
  startDate: Date;
  endDate: Date;
  /** Part que garde la boutique, en pourcentage (voir CLAUDE.md). */
  commission: number;
  /** `salePrice` est nullable en base : un article sans prix s'imprime « — ». */
  products: { reference: string | null; name: string; salePrice: number | null }[];
}

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 en points
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
/**
 * Sous cette ligne, on passe à la page suivante plutôt que de déborder.
 *
 * Prise haute exprès : le test tombe **avant** d'écrire la ligne, et un nom
 * d'article assez long pour tenir sur deux lignes déborderait sinon sur la
 * pagination automatique de pdfkit — qui coupe au milieu de la ligne et
 * décale les colonnes.
 */
const PAGE_BOTTOM = PAGE_HEIGHT - MARGIN - 45;

const COLUMNS = { reference: 90, price: 90 };

/** `35` → `35,00 €`. La virgule décimale, comme sur l'étiquette. */
export function euros(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

function frDate(value: Date): string {
  return value.toLocaleDateString('fr-FR', { timeZone: SHOP_TIMEZONE });
}

function fullName(depositor: ContractPdfData['depositor']): string {
  return [depositor.firstName, depositor.lastName].filter(Boolean).join(' ');
}

/**
 * Numéro court du contrat, imprimé en tête.
 *
 * Un `cuid` entier sur un papier à signer ne se recopie pas ; ses derniers
 * caractères suffisent à retrouver la fiche, et deux contrats du même déposant
 * ne se confondent plus.
 */
export function shortNumber(id: string): string {
  return id.slice(-6).toUpperCase();
}

/**
 * Nom du fichier proposé au téléchargement.
 *
 * Le code du déposant et la date de début : c'est ainsi que le gérant range
 * ses contrats. Tout ce qui n'est ni lettre ni chiffre est écrasé — un nom de
 * fichier porte des accents et des espaces, un en-tête HTTP les supporte mal.
 */
export function contractFileName(data: ContractPdfData): string {
  const who = data.depositor.code ?? data.depositor.lastName;
  const slug = who
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
  const day = data.startDate.toISOString().slice(0, 10);
  return `contrat-${slug || 'DEPOT'}-${day}.pdf`;
}

/** Les conditions imprimées sous la liste, numérotées. */
function conditions(data: ContractPdfData): string[] {
  const depositorShare = 100 - data.commission;
  return [
    `Le déposant confie à ${data.companyName} les articles listés ci-dessus, dont il déclare être le propriétaire.`,
    "Les articles restent la propriété du déposant jusqu'à leur vente ; ils ne sont ni achetés ni payés d'avance.",
    `Sur chaque vente, la boutique conserve ${data.commission} % du prix encaissé et reverse ${depositorShare} % au déposant.`,
    'Le prix affiché peut faire l’objet d’une remise ; la part du déposant est alors calculée sur le prix réellement encaissé.',
    `Les articles invendus au ${frDate(data.endDate)} sont restitués au déposant, sauf reconduction convenue entre les deux parties.`,
    'Le règlement des ventes se fait en espèces, contre signature du relevé remis au déposant.',
  ];
}

function drawTableHeader(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
  doc.text('RÉFÉRENCE', MARGIN, y, { width: COLUMNS.reference });
  doc.text('ARTICLE', MARGIN + COLUMNS.reference, y, {
    width: CONTENT_WIDTH - COLUMNS.reference - COLUMNS.price,
  });
  doc.text('PRIX DE VENTE', PAGE_WIDTH - MARGIN - COLUMNS.price, y, {
    width: COLUMNS.price,
    align: 'right',
  });
  doc.moveDown(0.4);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .strokeColor('#cbd5e1')
    .stroke();
  doc.moveDown(0.4);
}

/** Bloc « Déposant » / « Contrat », deux colonnes côte à côte. */
function drawParties(doc: PDFKit.PDFDocument, data: ContractPdfData): void {
  const top = doc.y;
  const half = CONTENT_WIDTH / 2 - 10;

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('DÉPOSANT', MARGIN, top);
  doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
  const identity = [
    fullName(data.depositor),
    data.depositor.code ? `Code déposant : ${data.depositor.code}` : null,
    data.depositor.address,
    data.depositor.phone,
    data.depositor.email,
    data.depositor.iban ? `IBAN : ${data.depositor.iban}` : null,
  ].filter((line): line is string => Boolean(line));
  doc.text(identity.join('\n'), MARGIN, doc.y + 4, { width: half });
  const leftBottom = doc.y;

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0f172a')
    .text('CONTRAT', MARGIN + half + 20, top);
  doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
  doc.text(
    [
      `Du ${frDate(data.startDate)} au ${frDate(data.endDate)}`,
      `Commission boutique : ${data.commission} %`,
      `Articles déposés : ${data.products.length}`,
    ].join('\n'),
    MARGIN + half + 20,
    top + 18,
    { width: half },
  );

  doc.y = Math.max(leftBottom, doc.y);
}

/**
 * Passe à la page suivante si le bloc à venir n'y tient plus.
 *
 * Les blocs qui suivent le tableau — conditions, signatures — se dessinent à
 * coups de coordonnées absolues, hors de la pagination automatique de pdfkit :
 * sans ce test, une zone de signature commencée à 30 points du bas s'imprimait
 * à moitié dans le vide.
 */
function ensureRoom(doc: PDFKit.PDFDocument, height: number): void {
  if (doc.y + height > PAGE_BOTTOM) doc.addPage();
}

/** Les deux zones de signature, côte à côte en bas du contrat. */
function drawSignatures(doc: PDFKit.PDFDocument, data: ContractPdfData): void {
  ensureRoom(doc, 110);
  const top = doc.y + 10;
  const half = CONTENT_WIDTH / 2 - 10;

  doc.font('Helvetica').fontSize(9).fillColor('#475569');
  doc.text(`Fait le ${frDate(new Date())}, en deux exemplaires.`, MARGIN, top, {
    width: CONTENT_WIDTH,
  });

  const boxTop = doc.y + 14;
  for (const [index, label] of [
    `Le déposant — ${fullName(data.depositor)}`,
    `La boutique — ${data.companyName}`,
  ].entries()) {
    const x = MARGIN + index * (half + 20);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(label, x, boxTop, {
      width: half,
    });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text('Signature précédée de « lu et approuvé »', x, boxTop + 14, { width: half });
    doc
      .rect(x, boxTop + 28, half, 70)
      .strokeColor('#cbd5e1')
      .stroke();
  }
  doc.y = boxTop + 98;
}

/**
 * Rend le contrat en PDF.
 *
 * `pdfkit` écrit dans un flux ; on le rassemble en mémoire plutôt que de le
 * diffuser, parce qu'un contrat de trente articles pèse quelques dizaines de
 * kilo-octets et qu'une erreur de rendu doit pouvoir remonter en 500 avant que
 * la réponse ait commencé à partir.
 */
export function renderContractPdf(data: ContractPdfData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    info: {
      Title: `Contrat de dépôt-vente ${shortNumber(data.id)}`,
      Author: data.companyName,
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // En-tête.
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0f172a')
    .text(data.companyName, MARGIN, MARGIN);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#334155')
    .text(`Contrat de dépôt-vente n° ${shortNumber(data.id)}`);
  doc.moveDown(1);

  drawParties(doc, data);
  doc.moveDown(1.5);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('ARTICLES DÉPOSÉS', MARGIN);
  doc.moveDown(0.5);
  drawTableHeader(doc);

  doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
  let total = 0;
  for (const product of data.products) {
    if (doc.y > PAGE_BOTTOM) {
      doc.addPage();
      drawTableHeader(doc);
      doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
    }
    total += product.salePrice ?? 0;
    const y = doc.y;
    doc.text(product.reference ?? '—', MARGIN, y, { width: COLUMNS.reference });
    doc.text(product.name, MARGIN + COLUMNS.reference, y, {
      width: CONTENT_WIDTH - COLUMNS.reference - COLUMNS.price - 10,
    });
    doc.text(
      product.salePrice === null ? '—' : euros(product.salePrice),
      PAGE_WIDTH - MARGIN - COLUMNS.price,
      y,
      {
        width: COLUMNS.price,
        align: 'right',
      },
    );
    doc.moveDown(0.35);
  }

  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .strokeColor('#cbd5e1')
    .stroke();
  doc.moveDown(0.4);
  const totalY = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
  doc.text('Total des prix affichés', MARGIN, totalY, {
    width: CONTENT_WIDTH - COLUMNS.price - 10,
    align: 'right',
  });
  doc.text(euros(total), PAGE_WIDTH - MARGIN - COLUMNS.price, totalY, {
    width: COLUMNS.price,
    align: 'right',
  });
  doc.moveDown(1.5);

  // Conditions.
  ensureRoom(doc, 120);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('CONDITIONS', MARGIN);
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#334155');
  for (const [index, line] of conditions(data).entries()) {
    doc.text(`${index + 1}. ${line}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.3);
  }
  doc.moveDown(1);

  drawSignatures(doc, data);

  doc.end();
  return finished;
}
