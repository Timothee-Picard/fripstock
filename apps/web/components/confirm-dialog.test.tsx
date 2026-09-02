import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

const props = { title: 'Supprimer ?', onClose: vi.fn() };

describe('ConfirmDialog', () => {
  it('ne rend rien tant qu’elle est fermée', () => {
    const { container } = render(
      <ConfirmDialog {...props} open={false}>
        <p>contenu</p>
      </ConfirmDialog>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('annonce son titre au lecteur d’écran', () => {
    render(
      <ConfirmDialog {...props} open>
        <p>contenu</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Supprimer ?' })).toBeInTheDocument();
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('donne le focus au premier champ : c’est là qu’on a quelque chose à faire', () => {
    render(
      <ConfirmDialog {...props} open>
        <input aria-label="mot de passe" />
        <button>ok</button>
      </ConfirmDialog>,
    );
    expect(screen.getByLabelText('mot de passe')).toHaveFocus();
  });

  it('garde le focus sur le cadre quand rien n’est focalisable', () => {
    render(
      <ConfirmDialog {...props} open>
        <p>rien à remplir</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('ferme sur Échap — la première touche qu’on essaie', async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog {...props} onClose={onClose} open>
        <p>contenu</p>
      </ConfirmDialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('n’écoute plus Échap une fois fermée', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ConfirmDialog {...props} onClose={onClose} open>
        <p>contenu</p>
      </ConfirmDialog>,
    );
    rerender(
      <ConfirmDialog {...props} onClose={onClose} open={false}>
        <p>contenu</p>
      </ConfirmDialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ferme au clic sur le fond, mais pas au clic dans la modale', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <ConfirmDialog {...props} onClose={onClose} open>
        <p>contenu</p>
      </ConfirmDialog>,
    );

    await userEvent.click(screen.getByText('contenu'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(container.firstElementChild!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
