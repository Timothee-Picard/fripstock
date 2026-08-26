import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DemoLogin } from './demo-login';

/** Le formulaire de connexion, tel que la page le rend. */
function Formulaire({ onSubmit }: { onSubmit?: () => void }) {
  const ref = createRef<HTMLFormElement>();
  return (
    <>
      <form
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <input name="email" defaultValue="" aria-label="email" />
        <input name="password" type="password" defaultValue="" aria-label="password" />
      </form>
      <DemoLogin formRef={ref} />
    </>
  );
}

describe('DemoLogin', () => {
  it('propose les deux comptes de démonstration', () => {
    render(<Formulaire />);
    expect(screen.getByRole('button', { name: /gérant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /employé/i })).toBeInTheDocument();
  });

  it('remplit le formulaire et le soumet en un clic', async () => {
    const envoi = vi.fn();
    render(<Formulaire onSubmit={envoi} />);
    await userEvent.click(screen.getByRole('button', { name: /gérant/i }));
    expect(screen.getByLabelText('email')).toHaveValue('gerant@fripstock.test');
    expect(screen.getByLabelText('password')).toHaveValue('fripstock');
    expect(envoi).toHaveBeenCalled();
  });

  it('remplit l’adresse de l’employé quand on choisit ce compte', async () => {
    render(<Formulaire />);
    await userEvent.click(screen.getByRole('button', { name: /employé/i }));
    expect(screen.getByLabelText('email')).toHaveValue('employe@fripstock.test');
  });

  it('ne plante pas si le formulaire n’est pas encore monté', async () => {
    const ref = createRef<HTMLFormElement>();
    render(<DemoLogin formRef={ref} />);
    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
