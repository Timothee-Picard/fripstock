'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Modale de confirmation.
 *
 * Le reste de l'application confirme par `window.confirm()`, ce qui suffit à une
 * suppression réparable : on recrée une catégorie mal effacée. Ici il n'y a rien
 * à recréer, et la confirmation doit **montrer** ce qui part et redemander le
 * mot de passe — deux choses qu'une boîte native ne sait pas faire.
 *
 * Écrite à la main plutôt qu'avec `<dialog>` : jsdom, où tournent les tests,
 * n'implémente pas `showModal()` (jsdom 30, vérifié). Le focus, la touche Échap
 * et le clic sur le fond sont donc gérés ici, et c'est le prix à payer.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Échap ferme : une confirmation qu'on ne peut quitter qu'à la souris se lit
  // comme un piège, et c'est la première touche qu'on essaie.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Le focus entre dans la modale à l'ouverture : sans ça il reste sur le
  // bouton qu'on vient de quitter, et la tabulation parcourt l'écran masqué.
  // Sur le premier champ plutôt que sur le cadre, parce que c'est là qu'on a
  // quelque chose à faire ; le cadre ne sert que de repli quand la modale ne
  // contient rien de focalisable.
  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href]',
    );
    (first ?? panel.current)?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      // Le fond ferme, le contenu non : sans le test sur la cible, un clic
      // n'importe où dans la modale la refermerait.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-base font-medium text-slate-900">
          {title}
        </h2>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
