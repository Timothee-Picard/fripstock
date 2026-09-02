import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountSummary } from '@/lib/types';

const deleteAccount = vi.fn();
vi.mock('./actions', () => ({ deleteAccount }));

const { DangerZone, accountLines } = await import('./danger-zone');

const summary = (over: Partial<AccountSummary> = {}): AccountSummary => ({
  companyName: 'Friperie Démo',
  shops: 3,
  employees: 2,
  products: 128,
  depositors: 4,
  contracts: 6,
  ...over,
});

const ouvrir = () => userEvent.click(screen.getByRole('button', { name: /Supprimer le compte/ }));

// L'action rend un état ou redirige — jamais rien : sans ça, `useActionState`
// reposerait sur `undefined` et le double mentirait sur le contrat.
beforeEach(() => deleteAccount.mockReset().mockResolvedValue({}));

describe('accountLines', () => {
  it('accorde le pluriel', () => {
    expect(accountLines(summary({ shops: 1, employees: 2 }))).toEqual(
      expect.arrayContaining(['1 boutique', '2 comptes employés']),
    );
  });

  it('passe sous silence ce qui est à zéro', () => {
    const lignes = accountLines(summary({ depositors: 0, contracts: 0 }));
    expect(lignes.join(' ')).not.toContain('déposant');
    expect(lignes.join(' ')).not.toContain('contrat');
  });

  it('ne rend rien pour une entreprise encore vide', () => {
    expect(
      accountLines({
        companyName: 'Neuve',
        shops: 0,
        employees: 0,
        products: 0,
        depositors: 0,
        contracts: 0,
      }),
    ).toEqual([]);
  });
});

describe('DangerZone', () => {
  it('nomme l’entreprise avant même d’ouvrir la confirmation', () => {
    render(<DangerZone summary={summary()} />);
    expect(screen.getByText(/Friperie Démo/)).toBeInTheDocument();
  });

  it('ne supprime rien tant que la confirmation n’est pas ouverte', () => {
    render(<DangerZone summary={summary()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('chiffre ce qui part, plutôt que d’annoncer « tout »', async () => {
    render(<DangerZone summary={summary()} />);
    await ouvrir();

    const modale = screen.getByRole('dialog');
    expect(modale).toHaveAccessibleName('Supprimer Friperie Démo ?');
    expect(modale).toHaveTextContent('3 boutiques');
    expect(modale).toHaveTextContent('128 produits');
    expect(modale).toHaveTextContent('6 contrats de dépôt');
  });

  it('le dit autrement quand il n’y a encore rien à perdre', async () => {
    render(
      <DangerZone
        summary={summary({ shops: 0, employees: 0, products: 0, depositors: 0, contracts: 0 })}
      />,
    );
    await ouvrir();
    expect(screen.getByRole('dialog')).toHaveTextContent('ne contient encore aucune donnée');
  });

  // Recherche partielle : le libellé accessible d'un `Field` emporte aussi son
  // aide, le texte exact ne s'arrête pas au titre du champ.
  it('redemande le mot de passe dans la modale, jamais sur l’écran', async () => {
    render(<DangerZone summary={summary()} />);
    expect(screen.queryByLabelText(/Votre mot de passe/)).not.toBeInTheDocument();
    await ouvrir();
    expect(screen.getByLabelText(/Votre mot de passe/)).toBeRequired();
  });

  it('renonce sans rien envoyer', async () => {
    render(<DangerZone summary={summary()} />);
    await ouvrir();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('envoie le mot de passe saisi au moment du geste', async () => {
    render(<DangerZone summary={summary()} />);
    await ouvrir();
    await userEvent.type(screen.getByLabelText(/Votre mot de passe/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    const data = deleteAccount.mock.calls[0][1] as FormData;
    expect(data.get('password')).toBe('secret');
  });

  it('garde la modale ouverte pour montrer le refus', async () => {
    deleteAccount.mockResolvedValue({ error: 'Mot de passe incorrect.' });
    render(<DangerZone summary={summary()} />);
    await ouvrir();
    await userEvent.type(screen.getByLabelText(/Votre mot de passe/), 'faux');
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    // Refermer sur l'erreur obligerait à tout reprendre pour lire pourquoi.
    expect(await screen.findByText('Mot de passe incorrect.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
