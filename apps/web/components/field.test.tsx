import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alert, Button, Field } from './field';

describe('Field', () => {
  it('associe le libellé à la saisie, pour la souris comme pour le lecteur d’écran', async () => {
    render(<Field label="Référence" name="reference" />);
    await userEvent.type(screen.getByLabelText('Référence'), 'BTR6');
    expect(screen.getByLabelText('Référence')).toHaveValue('BTR6');
  });

  it('affiche l’aide sous le champ quand elle est fournie', () => {
    render(<Field label="Adresse" hint="Facultative" />);
    expect(screen.getByText('Facultative')).toBeInTheDocument();
  });

  it('n’affiche rien de plus sans aide', () => {
    const { container } = render(<Field label="Nom" />);
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });

  it('transmet les attributs natifs, comme required ou le type', () => {
    render(<Field label="Prix" type="number" required />);
    const saisie = screen.getByLabelText('Prix');
    expect(saisie).toBeRequired();
    expect(saisie).toHaveAttribute('type', 'number');
  });

  it('donne au texte saisi une couleur foncée — un champ illisible ne sert à rien', () => {
    render(<Field label="Nom" />);
    expect(screen.getByLabelText('Nom').className).toContain('text-slate-900');
  });
});

describe('Button', () => {
  it('déclenche l’action au clic', async () => {
    const clic = vi.fn();
    render(<Button onClick={clic}>Enregistrer</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(clic).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche rien quand il est désactivé', async () => {
    const clic = vi.fn();
    render(
      <Button onClick={clic} disabled>
        Enregistrer
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(clic).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'danger'] as const)('accepte la variante %s', (variant) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('distingue visuellement la variante dangereuse', () => {
    const { rerender } = render(<Button variant="primary">x</Button>);
    const principal = screen.getByRole('button').className;
    rerender(<Button variant="danger">x</Button>);
    expect(screen.getByRole('button').className).not.toBe(principal);
    expect(screen.getByRole('button').className).toContain('red');
  });
});

describe('Alert', () => {
  it('affiche le message', () => {
    render(<Alert>Le nom est obligatoire.</Alert>);
    expect(screen.getByText('Le nom est obligatoire.')).toBeInTheDocument();
  });

  it('signale une erreur en rouge par défaut', () => {
    render(<Alert>Erreur</Alert>);
    expect(screen.getByText('Erreur').className).toContain('red');
  });

  it('reste neutre pour une information', () => {
    render(<Alert tone="info">Créé.</Alert>);
    expect(screen.getByText('Créé.').className).not.toContain('red');
  });
});
