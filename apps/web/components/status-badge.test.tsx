import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('affiche le libellé choisi par le gérant', () => {
    render(<StatusBadge status={{ name: 'En rayon', color: '#3b82f6' }} />);
    expect(screen.getByText('En rayon')).toBeInTheDocument();
  });

  it('reprend la couleur de fond définie en base', () => {
    render(<StatusBadge status={{ name: 'x', color: '#3b82f6' }} />);
    expect(screen.getByText('x')).toHaveStyle({ backgroundColor: '#3b82f6' });
  });

  it('écrit en foncé sur un fond clair', () => {
    render(<StatusBadge status={{ name: 'clair', color: '#fef08a' }} />);
    expect(screen.getByText('clair')).toHaveStyle({ color: '#0f172a' });
  });

  it('écrit en blanc sur un fond sombre', () => {
    render(<StatusBadge status={{ name: 'sombre', color: '#1e293b' }} />);
    expect(screen.getByText('sombre')).toHaveStyle({ color: '#ffffff' });
  });

  it('reste lisible si la couleur est mal formée', () => {
    render(<StatusBadge status={{ name: 'cassé', color: 'rouge' }} />);
    expect(screen.getByText('cassé')).toHaveStyle({ color: '#ffffff' });
  });

  it('ne coupe pas un libellé en deux lignes', () => {
    render(<StatusBadge status={{ name: 'Rendu au client', color: '#fff' }} />);
    expect(screen.getByText('Rendu au client').className).toContain('whitespace-nowrap');
  });
});
