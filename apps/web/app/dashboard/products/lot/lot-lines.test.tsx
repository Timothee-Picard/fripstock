import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LotLines } from './lot-lines';
import type { AttributeDefinition, CategoryTree } from '@/lib/types';

const tree: CategoryTree[] = [
  { id: 'haut', name: 'Haut', parentId: null, children: [] },
  { id: 'sac', name: 'Sac', parentId: null, children: [] },
];

const attributs: AttributeDefinition[] = [
  {
    id: 'a-couleur',
    name: 'Couleur',
    type: 'SELECT',
    clonedFromTemplateId: null,
    options: [{ id: 'o-noir', value: 'Noir', position: 0 }],
    categories: [{ categoryId: 'haut' }],
  },
];

function rendre(total = 7) {
  return render(<LotLines tree={tree} attributes={attributs} totalPurchasePrice={total} />);
}

const nomDe = (n: number) => screen.getByLabelText(`Nom de la ligne ${n}`);
const prixDe = (n: number) => screen.getByLabelText(`Prix de vente de la ligne ${n}`);
const nombreDe = (n: number) => screen.getByLabelText(`Nombre d'exemplaires de la ligne ${n}`);
const categorieDe = (n: number) => screen.getByLabelText(`Catégorie de la ligne ${n}`);
const achatDe = (n: number) => screen.getByLabelText(`Prix d'achat calculé de la ligne ${n}`);

/** Le lot de l'énoncé : 4 t-shirts à 10 €, 2 chemises à 20 €, payé 7 €. */
async function saisirLeLot() {
  rendre(7);
  await userEvent.type(nomDe(1), 'T-shirt');
  await userEvent.type(nomDe(2), 'Chemise');
  await userEvent.type(prixDe(1), '10');
  await userEvent.clear(nombreDe(1));
  await userEvent.type(nombreDe(1), '4');
  await userEvent.type(prixDe(2), '20');
  await userEvent.clear(nombreDe(2));
  await userEvent.type(nombreDe(2), '2');
}

describe('LotLines', () => {
  it('ouvre sur deux lignes vides', () => {
    rendre();
    expect(screen.getAllByLabelText(/^Nom de la ligne/)).toHaveLength(2);
  });

  it('répartit le prix payé au prorata du prix de vente', async () => {
    await saisirLeLot();
    // 4 t-shirts à 0,88/0,88/0,87/0,87 — la ligne affiche la part unitaire.
    expect(achatDe(1)).toHaveTextContent('0,88 €');
    expect(achatDe(2)).toHaveTextContent('1,75 €');
  });

  it('affiche le total de la ligne quand elle porte plusieurs exemplaires', async () => {
    await saisirLeLot();
    expect(achatDe(1)).toHaveTextContent('×4 = 3,50 €');
    expect(achatDe(2)).toHaveTextContent('×2 = 3,50 €');
  });

  it('récapitule le nombre d’articles, l’achat et la marge', async () => {
    await saisirLeLot();
    const recap = screen.getByRole('status');
    expect(recap).toHaveTextContent('6 articles');
    expect(recap).toHaveTextContent('7,00 €');
    expect(recap).toHaveTextContent('80,00 €');
    expect(recap).toHaveTextContent('91 %');
  });

  it('recalcule dès qu’un prix change', async () => {
    rendre(10);
    await userEvent.type(nomDe(1), 'A');
    await userEvent.type(nomDe(2), 'B');
    await userEvent.type(prixDe(1), '10');
    await userEvent.type(prixDe(2), '10');
    expect(achatDe(1)).toHaveTextContent('5,00 €');

    await userEvent.clear(prixDe(2));
    await userEvent.type(prixDe(2), '30');
    expect(achatDe(1)).toHaveTextContent('2,50 €');
    expect(achatDe(2)).toHaveTextContent('7,50 €');
  });

  it('partage à parts égales tant qu’aucun prix de vente n’est saisi', async () => {
    rendre(6);
    await userEvent.type(nomDe(1), 'Vrac');
    await userEvent.type(nomDe(2), 'Divers');
    await userEvent.type(nombreDe(1), '3');
    // 4 articles se partagent 6 € : 1,50 € chacun, quel que soit leur modèle.
    expect(achatDe(1)).toHaveTextContent('1,50 €');
    expect(achatDe(1)).toHaveTextContent('×3 = 4,50 €');
    expect(achatDe(2)).toHaveTextContent('1,50 €');
  });

  it('compte un exemplaire par défaut', async () => {
    rendre(4);
    await userEvent.type(nomDe(1), 'A');
    await userEvent.type(nomDe(2), 'B');
    await userEvent.type(prixDe(1), '10');
    await userEvent.type(prixDe(2), '10');
    expect(achatDe(1)).toHaveTextContent('2,00 €');
    expect(achatDe(1)).not.toHaveTextContent('×');
  });

  it('fait apparaître les colonnes d’attributs de la catégorie choisie', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'haut');
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toContain('Couleur');
  });

  it('neutralise la cellule d’attribut sans objet pour sa ligne', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'haut');
    await userEvent.selectOptions(categorieDe(2), 'sac');
    const lignes = screen.getAllByRole('row');
    const entetes = screen.getAllByRole('columnheader').map((th) => th.textContent);
    const cellules = within(lignes[2]).getAllByRole('cell');
    expect(cellules[entetes.indexOf('Couleur')]).toHaveAttribute('aria-disabled', 'true');
  });

  it('ajoute une ligne vide dès que la dernière sert', async () => {
    rendre();
    await userEvent.type(nomDe(2), 'A');
    expect(screen.getAllByLabelText(/^Nom de la ligne/)).toHaveLength(3);
  });

  it('retire une ligne, mais en garde toujours une', async () => {
    rendre();
    await userEvent.click(screen.getByLabelText('Retirer la ligne 2'));
    expect(screen.getAllByLabelText(/^Nom de la ligne/)).toHaveLength(1);
    expect(screen.getByLabelText('Retirer la ligne 1')).toBeDisabled();
  });

  it('poste un identifiant par ligne', () => {
    const { container } = rendre();
    expect(container.querySelectorAll('input[name="lineId"]')).toHaveLength(2);
  });

  it('replie description et commentaire', async () => {
    rendre();
    const entetes = () => screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(entetes()).not.toContain('Description');
    await userEvent.click(screen.getByLabelText('Description et commentaire'));
    expect(entetes()).toContain('Description');
  });

  it('ne fait pas payer la ligne vide gardée en bas du tableau', async () => {
    rendre(6);
    await userEvent.type(nomDe(1), 'Vrac');
    // Sans prix de vente le partage est égal : si la ligne vide comptait, elle
    // emporterait la moitié du lot.
    expect(achatDe(1)).toHaveTextContent('6,00 €');
    expect(achatDe(2)).toHaveTextContent('—');
    expect(screen.getByRole('status')).toHaveTextContent('1 article');
  });

  it('montre une colonne d’achat en lecture seule — la règle vit côté API', () => {
    rendre();
    const entetes = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(entetes).toContain('Achat (€)');
    expect(within(achatDe(1)).queryByRole('textbox')).toBeNull();
  });
});
