import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ContractLines } from './contract-lines';
import type { AttributeDefinition, CategoryTree } from '@/lib/types';

const tree: CategoryTree[] = [
  {
    id: 'vetements',
    name: 'Vêtements',
    parentId: null,
    children: [{ id: 'robe', name: 'Robe', parentId: 'vetements', children: [] }],
  },
  { id: 'sac', name: 'Sac', parentId: null, children: [] },
];

const attributs: AttributeDefinition[] = [
  {
    id: 'a-couleur',
    name: 'Couleur',
    type: 'SELECT',
    clonedFromTemplateId: null,
    options: [
      { id: 'o-noir', value: 'Noir', position: 0 },
      { id: 'o-beige', value: 'Beige', position: 1 },
    ],
    categories: [{ categoryId: 'robe' }, { categoryId: 'sac' }],
  },
  {
    id: 'a-taille',
    name: 'Taille',
    type: 'MULTISELECT',
    clonedFromTemplateId: null,
    options: [
      { id: 'o-s', value: 'S', position: 0 },
      { id: 'o-m', value: 'M', position: 1 },
    ],
    categories: [{ categoryId: 'robe' }],
  },
  {
    id: 'a-poids',
    name: 'Poids',
    type: 'NUMBER',
    clonedFromTemplateId: null,
    options: [],
    categories: [{ categoryId: 'sac' }],
  },
];

function rendre() {
  return render(<ContractLines tree={tree} attributes={attributs} />);
}

/** En-têtes de colonnes du tableau. */
function colonnes(): string[] {
  return screen
    .getAllByRole('columnheader')
    .map((th) => th.textContent?.trim() ?? '')
    .filter(Boolean);
}

const categorieDe = (n: number) => screen.getByLabelText(`Catégorie de l'article ${n}`);

describe('ContractLines', () => {
  it('ouvre sur trois lignes vides, prêtes à la saisie', () => {
    rendre();
    expect(screen.getAllByLabelText(/^Nom de l'article/)).toHaveLength(3);
  });

  it('propose les catégories indentées selon la hiérarchie', async () => {
    rendre();
    const options = within(categorieDe(1)).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      '—',
      'Vêtements',
      '\u00a0\u00a0└ Robe',
      'Sac',
    ]);
  });

  it('n’affiche aucune colonne d’attribut tant qu’aucune catégorie n’est choisie', () => {
    rendre();
    expect(colonnes()).toEqual(['#', 'Nom', 'Référence', 'Catégorie', 'Prix (€)', 'Qté']);
  });

  it('fait apparaître les colonnes des attributs de la catégorie choisie', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'robe');
    expect(colonnes()).toContain('Couleur');
    expect(colonnes()).toContain('Taille');
    expect(colonnes()).not.toContain('Poids');
  });

  it('réunit les colonnes de toutes les catégories présentes dans le tableau', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'robe');
    await userEvent.selectOptions(categorieDe(2), 'sac');
    for (const nom of ['Couleur', 'Taille', 'Poids']) expect(colonnes()).toContain(nom);
  });

  it('neutralise la cellule dont l’attribut ne s’applique pas à sa ligne', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'robe');
    await userEvent.selectOptions(categorieDe(2), 'sac');

    // « Taille » ne concerne que les robes : la cellule du sac reste vide.
    const lignes = screen.getAllByRole('row');
    const cellulesSac = within(lignes[2]).getAllByRole('cell');
    const indexTaille = colonnes().indexOf('Taille');
    expect(within(cellulesSac[indexTaille]).queryAllByRole('checkbox')).toHaveLength(0);
    expect(cellulesSac[indexTaille]).toHaveAttribute('aria-disabled', 'true');
  });

  it('nomme les cellules d’attribut pour que l’action les retrouve', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'robe');
    const couleur = screen
      .getAllByRole('combobox')
      .find((s) => s.getAttribute('name')?.endsWith(':attr:a-couleur'));
    expect(couleur).toBeDefined();
    expect(couleur?.getAttribute('name')).toMatch(/^line:l\d+:attr:a-couleur$/);
  });

  it('offre les options d’un multiselect en cases à cocher, sans Ctrl-clic', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'robe');
    expect(screen.getByLabelText('S')).toBeInTheDocument();
    expect(screen.getByLabelText('M')).toBeInTheDocument();
  });

  it('ajoute une ligne vide dès que la dernière reçoit une catégorie', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(3), 'sac');
    expect(screen.getAllByLabelText(/^Nom de l'article/)).toHaveLength(4);
  });

  it('reprend la dernière catégorie renseignée sur une ligne ajoutée à la main', async () => {
    rendre();
    await userEvent.selectOptions(categorieDe(1), 'sac');
    await userEvent.click(screen.getByRole('button', { name: '+ Ajouter une ligne' }));
    expect(categorieDe(4)).toHaveValue('sac');
  });

  it('retire une ligne', async () => {
    rendre();
    await userEvent.click(screen.getByLabelText("Retirer l'article 2"));
    expect(screen.getAllByLabelText(/^Nom de l'article/)).toHaveLength(2);
  });

  it('garde toujours au moins une ligne', async () => {
    rendre();
    await userEvent.click(screen.getByLabelText("Retirer l'article 3"));
    await userEvent.click(screen.getByLabelText("Retirer l'article 2"));
    expect(screen.getByLabelText("Retirer l'article 1")).toBeDisabled();
  });

  it('replie description et commentaire par défaut', async () => {
    rendre();
    expect(colonnes()).not.toContain('Description');
    await userEvent.click(screen.getByLabelText('Description et commentaire'));
    expect(colonnes()).toContain('Description');
    expect(colonnes()).toContain('Commentaire');
  });

  it('poste un identifiant par ligne, pour regrouper les cellules', () => {
    const { container } = rendre();
    expect(container.querySelectorAll('input[name="lineId"]')).toHaveLength(3);
  });

  it('ne propose pas de prix d’achat : l’article appartient au déposant', () => {
    rendre();
    expect(colonnes()).not.toContain("Prix d'achat");
  });
});
