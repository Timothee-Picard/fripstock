import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardModules, type DashboardModule } from './dashboard-modules';

const modules: DashboardModule[] = [
  { key: 'a', title: 'Ventes sur la période', visible: true, content: <p>courbe</p> },
  { key: 'b', title: 'Stock par statut', visible: true, content: <p>camembert</p> },
  {
    key: 'attribute:1',
    title: 'Meilleures ventes par couleur',
    visible: false,
    content: <p>couleurs</p>,
    attribute: { id: '1', name: 'Couleur' },
  },
  {
    key: 'attribute:2',
    title: 'Meilleures ventes par marque',
    visible: false,
    content: <p>marques</p>,
    attribute: { id: '2', name: 'Marque' },
  },
];

/** Titres des cartes affichées, dans leur ordre à l'écran. */
function ordre(): string[] {
  const zone = screen.getByRole('group', { name: 'Modules affichés' });
  return within(zone)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent ?? '');
}

/** La carte entière, celle qui porte le glisser-déposer. */
function carte(titre: string): HTMLElement {
  return screen.getByRole('heading', { name: titre }).closest('[draggable]') as HTMLElement;
}

function setup(save = vi.fn().mockResolvedValue({})) {
  const user = userEvent.setup();
  render(<DashboardModules modules={modules} save={save} />);
  return { user, save };
}

describe('DashboardModules', () => {
  it('affiche les modules visibles et tait les autres', () => {
    setup();
    expect(ordre()).toEqual(['Ventes sur la période', 'Stock par statut']);
    expect(screen.queryByText('Meilleures ventes par couleur')).not.toBeInTheDocument();
  });

  it('ne montre les outils de rangement qu’une fois « Personnaliser » ouvert', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: /Masquer/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    expect(screen.getAllByRole('button', { name: /Masquer/ })).toHaveLength(2);
  });

  it('déplace une carte au clavier, sans souris', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(
      screen.getByRole('button', { name: 'Déplacer « Stock par statut » vers le haut' }),
    );
    expect(ordre()).toEqual(['Stock par statut', 'Ventes sur la période']);
  });

  it('ne déplace rien au-delà du bord de la zone', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(
      screen.getByRole('button', { name: 'Déplacer « Ventes sur la période » vers le haut' }),
    );
    expect(ordre()).toEqual(['Ventes sur la période', 'Stock par statut']);
  });

  it('masque une carte et la repropose dans la réserve', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(screen.getByRole('button', { name: 'Masquer « Stock par statut »' }));
    expect(ordre()).toEqual(['Ventes sur la période']);

    const reserve = screen.getByRole('list');
    expect(within(reserve).getByText('Stock par statut')).toBeInTheDocument();
    await user.click(within(reserve).getByRole('button', { name: /Stock par statut/ }));
    // Réaffichée à sa place, et non repoussée à la fin.
    expect(ordre()).toEqual(['Ventes sur la période', 'Stock par statut']);
  });

  it('déplace une carte en la glissant sur une autre', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    fireEvent.dragStart(carte('Stock par statut'));
    fireEvent.dragOver(carte('Ventes sur la période'));
    fireEvent.drop(carte('Ventes sur la période'));
    expect(ordre()).toEqual(['Stock par statut', 'Ventes sur la période']);
  });

  it('ne glisse rien tant que le rangement n’est pas ouvert', () => {
    setup();
    // Hors rangement, les cartes ne sont même pas saisissables : le tableau de
    // bord se lit, il ne se déplace pas par accident.
    expect(carte('Stock par statut')).toHaveAttribute('draggable', 'false');
  });

  it('ne propose qu’une entrée générique pour les classements par attribut', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    // Une seule entrée, quel que soit le nombre d'attributs : la réserve ne les
    // énumère pas, sinon elle se périmerait à la première suppression.
    expect(
      screen.getByRole('button', { name: /Meilleures ventes par attribut/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /par couleur/ })).not.toBeInTheDocument();
  });

  it('ajoute le module autant de fois qu’il reste d’attributs', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    const ajouter = () => screen.getByRole('button', { name: /Meilleures ventes par attribut/ });

    await user.click(ajouter());
    expect(ordre()).toEqual([
      'Ventes sur la période',
      'Stock par statut',
      'Meilleures ventes par couleur',
    ]);

    await user.click(ajouter());
    expect(ordre()).toContain('Meilleures ventes par marque');
    // Plus d'attribut libre : l'entrée disparaît plutôt que de ne rien faire.
    expect(screen.queryByRole('button', { name: /Meilleures ventes par attribut/ })).toBeNull();
  });

  it('change l’attribut d’une carte sans lui faire perdre sa place', async () => {
    const { user, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(screen.getByRole('button', { name: /Meilleures ventes par attribut/ }));
    await user.click(
      screen.getByRole('button', {
        name: 'Déplacer « Meilleures ventes par couleur » vers le haut',
      }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Attribut classé par cette carte' }),
      'attribute:2',
    );

    expect(ordre()).toEqual([
      'Ventes sur la période',
      'Meilleures ventes par marque',
      'Stock par statut',
    ]);
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    // La couleur est retournée dans la réserve, pas perdue.
    expect(save).toHaveBeenCalledWith(
      expect.arrayContaining([{ key: 'attribute:1', visible: false }]),
    );
  });

  it('parle de retirer une carte d’attribut, pas de la masquer', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(screen.getByRole('button', { name: /Meilleures ventes par attribut/ }));
    await user.click(
      screen.getByRole('button', { name: 'Retirer « Meilleures ventes par couleur »' }),
    );
    expect(ordre()).toEqual(['Ventes sur la période', 'Stock par statut']);
  });

  it('n’enregistre qu’au « Terminer », le rangement complet', async () => {
    const { user, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(screen.getByRole('button', { name: 'Masquer « Ventes sur la période »' }));
    expect(save).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(save).toHaveBeenCalledWith([
      { key: 'a', visible: false },
      { key: 'b', visible: true },
      { key: 'attribute:1', visible: false },
      { key: 'attribute:2', visible: false },
    ]);
    expect(screen.getByRole('button', { name: 'Personnaliser' })).toBeInTheDocument();
  });

  it('rend l’essai raté annulable', async () => {
    const { user, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(screen.getByRole('button', { name: 'Masquer « Ventes sur la période »' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(ordre()).toEqual(['Ventes sur la période', 'Stock par statut']);
    expect(save).not.toHaveBeenCalled();
  });

  it('reste en rangement et le dit quand l’enregistrement échoue', async () => {
    const { user } = setup(vi.fn().mockResolvedValue({ error: 'Session expirée.' }));
    await user.click(screen.getByRole('button', { name: 'Personnaliser' }));
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Session expirée.');
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeInTheDocument();
  });

  it('le dit plutôt que de laisser une zone vide sans explication', () => {
    render(
      <DashboardModules modules={modules.map((m) => ({ ...m, visible: false }))} save={vi.fn()} />,
    );
    expect(screen.getByText(/Tous les modules sont masqués/)).toBeInTheDocument();
  });
});
