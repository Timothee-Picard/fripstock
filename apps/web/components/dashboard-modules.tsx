'use client';

import { useState, useTransition } from 'react';
import { AddIcon, DragIcon, HideIcon } from '@/components/icons';
import type { DashboardLayoutEntry } from '@/lib/types';

/**
 * Un module du tableau de bord : une carte, son titre, et ce qu'elle contient.
 *
 * `content` est **rendu par le serveur** et passé ici en propriété. C'est ce
 * qui permet à cette zone d'être un composant client — il lui faut de l'état
 * pour le glisser-déposer — sans que les graphiques et leurs données aient à
 * traverser une frontière de plus.
 */
export interface DashboardModule {
  key: string;
  title: string;
  hint?: string;
  /** Visibilité au chargement : rangement enregistré, ou valeur par défaut. */
  visible: boolean;
  content: React.ReactNode;
  /**
   * Renseigné pour les cartes du module « Meilleures ventes par attribut ».
   *
   * Ce module n'existe pas en un exemplaire : on l'ajoute autant de fois qu'on
   * veut, et chaque carte porte l'attribut qu'elle classe. Les attributs
   * n'étant pas figés — le gérant en crée et en supprime — la réserve ne les
   * énumère pas un à un : elle propose **une** entrée générique, et le choix
   * se fait sur la carte. Un attribut supprimé emporte sa carte, sans laisser
   * d'entrée morte dans le rangement.
   */
  attribute?: { id: string; name: string };
}

function Card({
  title,
  hint,
  toolbar,
  dragging,
  children,
}: {
  title: string;
  hint?: string;
  toolbar?: React.ReactNode;
  dragging?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        'rounded-lg border bg-white p-5 transition ' +
        (dragging ? 'border-slate-900 opacity-50' : 'border-slate-200')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-900">{title}</h3>
          {hint ? <p className="mt-0.5 mb-2 text-xs text-slate-600">{hint}</p> : null}
        </div>
        {toolbar}
      </div>
      {children}
    </section>
  );
}

/** Bouton d'outil d'une carte en cours de rangement — icône seule, titre lisible. */
function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md border border-slate-300 px-1.5 py-1 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
    >
      {children}
    </button>
  );
}

/**
 * Zone des modules du tableau de bord : ce qui s'affiche, et dans quel ordre.
 *
 * Le rangement se fait **sur place**, par glisser-déposer, et ne quitte jamais
 * la zone : les cartes sont les seules cibles de dépôt, donc rien ne peut
 * atterrir dans la recette du jour ni dans le comptoir, qui n'ont pas à bouger.
 *
 * Le glisser-déposer natif du navigateur, sans bibliothèque : une grille de
 * cartes n'a besoin que de « je prends celle-ci » et « je la pose là », et
 * ajouter une dépendance pour ça la ferait payer à chaque chargement.
 *
 * Il ne suffit pas à lui seul : on ne glisse rien au clavier. Chaque carte
 * porte donc aussi deux boutons de déplacement, qui font exactement la même
 * chose — ils ne sont pas un pis-aller, ils sont la version utilisable sans
 * souris.
 *
 * Rien n'est enregistré tant qu'on n'a pas cliqué « Terminer » : on essaie un
 * rangement, on le regarde, et on le garde ou on l'abandonne. Enregistrer à
 * chaque déplacement aurait figé l'essai raté avant qu'on ait pu se raviser.
 */
export function DashboardModules({
  modules,
  save,
}: {
  modules: DashboardModule[];
  /** Action serveur : enregistre le rangement complet, ou dit pourquoi non. */
  save: (modules: DashboardLayoutEntry[]) => Promise<{ error?: string }>;
}) {
  const fromProps = (): DashboardLayoutEntry[] =>
    modules.map((m) => ({ key: m.key, visible: m.visible }));

  // Ce que le serveur vient d'envoyer. Changer de période ou de boutique
  // recharge la page sans démonter ce composant : sans cette comparaison, un
  // rangement enregistré ailleurs — ou un module apparu depuis — resterait
  // invisible derrière un état devenu périmé.
  const signature = modules.map((m) => `${m.key}:${m.visible}`).join('|');
  const [snapshot, setSnapshot] = useState(signature);
  const [order, setOrder] = useState<DashboardLayoutEntry[]>(fromProps);
  const [editing, setEditing] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (snapshot !== signature) {
    setSnapshot(signature);
    setOrder(fromProps());
    setEditing(false);
    setDragged(null);
  }

  if (modules.length === 0) return null;

  const byKey = new Map(modules.map((m) => [m.key, m]));
  const visibles = order.filter((e) => e.visible);
  const hidden = order.filter((e) => !e.visible);
  /** Les attributs pas encore posés sur une carte : de quoi en ajouter une. */
  const attributsLibres = hidden.filter((e) => byKey.get(e.key)?.attribute);
  /** Les modules fixes masqués, eux, se reproposent nommément. */
  const fixesMasques = hidden.filter((e) => !byKey.get(e.key)?.attribute);

  /** Déplace un module juste avant ou après un autre, dans la liste complète. */
  function moveBefore(key: string, targetKey: string) {
    setOrder((prev) => {
      const from = prev.findIndex((e) => e.key === key);
      const to = prev.findIndex((e) => e.key === targetKey);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      // `to` a glissé d'un cran si l'élément retiré était avant lui : insérer à
      // cet indice pose donc la carte après la cible quand on descend, avant
      // quand on remonte. C'est exactement ce que le geste veut dire.
      next.splice(to, 0, moved);
      return next;
    });
  }

  /** Déplacement au clavier : d'un cran parmi les cartes **visibles**. */
  function shift(key: string, direction: -1 | 1) {
    const affichees = order.filter((e) => e.visible);
    const index = affichees.findIndex((e) => e.key === key);
    const target = affichees[index + direction];
    if (target) moveBefore(key, target.key);
  }

  /**
   * Ajoute une carte « Meilleures ventes par attribut », posée à la fin.
   *
   * Elle prend le premier attribut libre : c'en est forcément un qui n'est pas
   * déjà affiché, et le menu de la carte permet aussitôt d'en changer. Poser la
   * carte d'abord et choisir ensuite évite un dialogue pour un seul champ.
   */
  function addAttributeCard() {
    const libre = attributsLibres[0];
    if (!libre) return;
    setOrder((prev) => [...prev.filter((e) => e.key !== libre.key), { ...libre, visible: true }]);
  }

  /**
   * Change l'attribut classé par une carte.
   *
   * Les deux entrées **échangent** leur sort : la carte garde sa place, et
   * l'attribut qu'elle abandonne retourne dans la réserve. Rien n'est créé ni
   * détruit, donc le rangement reste une permutation de la même liste.
   */
  function chooseAttribute(currentKey: string, nextKey: string) {
    setOrder((prev) =>
      prev.map((e) => {
        if (e.key === currentKey) return { key: nextKey, visible: true };
        if (e.key === nextKey) return { key: currentKey, visible: false };
        return e;
      }),
    );
  }

  function toggle(key: string) {
    setOrder((prev) => prev.map((e) => (e.key === key ? { ...e, visible: !e.visible } : e)));
  }

  function finish() {
    startSaving(async () => {
      const result = await save(order);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
    });
  }

  function cancel() {
    setOrder(fromProps());
    setError(null);
    setEditing(false);
  }

  return (
    <section aria-label="Modules du tableau de bord" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-slate-600">
          {editing
            ? 'Glissez une carte sur une autre pour la déplacer, ou utilisez les flèches. Le rangement ne vaut que pour votre compte.'
            : null}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Terminer'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Personnaliser
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          Tous les modules sont masqués.
          {editing ? null : ' Ouvrez « Personnaliser » pour en réafficher.'}
        </p>
      ) : (
        <div
          role="group"
          aria-label="Modules affichés"
          className={visibles.length > 1 ? 'grid gap-4 xl:grid-cols-2' : 'grid gap-4'}
        >
          {visibles.map((entry, index) => {
            const carte = byKey.get(entry.key)!;
            return (
              <div
                key={entry.key}
                draggable={editing}
                onDragStart={() => setDragged(entry.key)}
                onDragEnd={() => setDragged(null)}
                onDragOver={(e) => {
                  if (!editing || dragged === null || dragged === entry.key) return;
                  // Sans ce `preventDefault`, le navigateur refuse le dépôt.
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!editing || dragged === null) return;
                  e.preventDefault();
                  moveBefore(dragged, entry.key);
                  setDragged(null);
                }}
              >
                <Card
                  title={carte.title}
                  hint={carte.hint}
                  dragging={dragged === entry.key}
                  toolbar={
                    editing ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <span
                          className="cursor-grab px-1 text-slate-400"
                          aria-hidden
                          title="Glisser pour déplacer"
                        >
                          <DragIcon />
                        </span>
                        <ToolButton
                          label={`Déplacer « ${carte.title} » vers le haut`}
                          onClick={() => shift(entry.key, -1)}
                        >
                          <span aria-hidden>↑</span>
                        </ToolButton>
                        <ToolButton
                          label={`Déplacer « ${carte.title} » vers le bas`}
                          onClick={() => shift(entry.key, 1)}
                        >
                          <span aria-hidden>↓</span>
                        </ToolButton>
                        {carte.attribute ? (
                          // Le choix vit sur la carte, pas dans la réserve :
                          // c'est là qu'on voit le classement qu'on change.
                          <select
                            value={entry.key}
                            onChange={(e) => chooseAttribute(entry.key, e.target.value)}
                            aria-label="Attribut classé par cette carte"
                            className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-sm text-slate-700"
                          >
                            {[carte, ...attributsLibres.map((a) => byKey.get(a.key)!)].map((m) => (
                              <option key={m.key} value={m.key}>
                                {m.attribute!.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <ToolButton
                          label={
                            carte.attribute
                              ? `Retirer « ${carte.title} »`
                              : `Masquer « ${carte.title} »`
                          }
                          onClick={() => toggle(entry.key)}
                        >
                          <HideIcon />
                        </ToolButton>
                        <span className="sr-only">
                          Position {index + 1} sur {visibles.length}
                        </span>
                      </div>
                    ) : null
                  }
                >
                  {carte.content}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Les masqués ne se devinent pas : sans cette réserve, un module écarté
          serait perdu, personne ne pouvant deviner qu'il a existé. */}
      {editing ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <h3 className="text-xs font-medium tracking-wide text-slate-700 uppercase">
            Modules masqués
          </h3>
          {hidden.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aucun : tout est affiché.</p>
          ) : (
            <>
              <ul className="mt-2 flex flex-wrap gap-2">
                {fixesMasques.map((entry) => (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onClick={() => toggle(entry.key)}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <AddIcon />
                      {byKey.get(entry.key)!.title}
                    </button>
                  </li>
                ))}
                {/* Une entrée générique et non une par attribut : les attributs
                    vont et viennent, et une réserve qui les énumère se
                    périmerait à la première suppression. */}
                {attributsLibres.length > 0 ? (
                  <li>
                    <button
                      type="button"
                      onClick={addAttributeCard}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <AddIcon />
                      Meilleures ventes par attribut
                    </button>
                  </li>
                ) : null}
              </ul>
              {attributsLibres.length > 0 ? (
                <p className="mt-2 text-xs text-slate-600">
                  Ajoutez-en autant que vous voulez : l&apos;attribut classé se choisit sur la
                  carte.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
