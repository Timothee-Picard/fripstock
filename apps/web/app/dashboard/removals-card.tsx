'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { markRemovalDone, markRemovalsDone, type ProductState } from './products/actions';
import { Alert } from '@/components/field';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/dates';
import type { RemovalItem, RemovalList } from '@/lib/types';

const INITIAL_STATE: ProductState = {};

/**
 * Retraits à faire, sur le tableau de bord.
 *
 * Un article vendu d'un côté reste visible ou vendable de l'autre tant que
 * personne n'est allé l'en retirer. C'est une corvée quotidienne, elle a donc
 * sa place sur l'écran qu'on ouvre le matin, pas au fond d'un filtre.
 *
 * Deux listes séparées, parce que ce ne sont ni les mêmes gestes ni les mêmes
 * personnes : dépublier une annonce revient à qui gère le site, décrocher un
 * vêtement à qui tient la boutique. Chacun ne voit que la sienne — c'est le
 * droit qui décide, et l'API n'envoie que la liste correspondante.
 */
function Ligne({ item }: { item: RemovalItem }) {
  const [state, action, pending] = useActionState(markRemovalDone, INITIAL_STATE);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <form action={action} className="contents">
        <input type="hidden" name="id" value={item.id} />
        <Link
          href={`/dashboard/products/${item.id}`}
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {item.name}
        </Link>
        {item.reference ? (
          <span className="font-mono text-xs text-slate-600">{item.reference}</span>
        ) : null}
        {/* Le statut dit par quel canal l'article est parti — c'est lui qui
            explique le geste demandé. */}
        <StatusBadge status={item.status} />
        {item.shop ? <span className="text-xs text-slate-600">{item.shop.name}</span> : null}
        {item.soldAt ? (
          <span className="text-xs text-slate-600">vendu le {formatDate(item.soldAt)}</span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? '…' : 'Retrait effectué'}
        </button>
        {state.error ? (
          <div className="w-full">
            <Alert>{state.error}</Alert>
          </div>
        ) : null}
      </form>
    </li>
  );
}

/**
 * Combien de lignes avant de replier.
 *
 * Assez pour voir qu'il y a du travail et en expédier deux ou trois sans rien
 * déplier ; assez peu pour que les chiffres restent visibles en dessous. Le
 * reste s'ouvre d'un clic, et défile plutôt que d'allonger la page à l'infini.
 */
const APERCU = 5;

function Liste({
  title,
  hint,
  geste,
  liste,
}: {
  title: string;
  hint: string;
  /** Ce que le bouton groupé annonce avoir fait. */
  geste: string;
  liste: RemovalList;
}) {
  const [state, action, pending] = useActionState(markRemovalsDone, INITIAL_STATE);
  const [deplie, setDeplie] = useState(false);

  const visibles = deplie ? liste.items : liste.items.slice(0, APERCU);
  const restants = liste.total - visibles.length;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-5">
      <h3 className="flex items-center gap-2 text-sm font-medium text-amber-900">
        {title}
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
          {liste.total}
        </span>
      </h3>
      <p className="mt-0.5 text-xs text-amber-800">{hint}</p>

      {/* Déplié, la liste défile dans son cadre : cinquante lignes ne doivent
          pas repousser les chiffres hors de l'écran. */}
      <ul className={`mt-2 divide-y divide-amber-200 ${deplie ? 'max-h-96 overflow-y-auto' : ''}`}>
        {visibles.map((item) => (
          <Ligne key={item.id} item={item} />
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {restants > 0 ? (
          <button
            type="button"
            onClick={() => setDeplie(true)}
            className="font-medium text-amber-900 underline underline-offset-2"
          >
            Afficher {restants} de plus
          </button>
        ) : null}
        {/* Un article plus ancien peut n'être ni dans l'aperçu ni dans les
            cinquante renvoyés : la liste complète, elle, se cherche. */}
        <Link
          href="/dashboard/removals"
          className="font-medium text-amber-900 underline underline-offset-2"
        >
          Voir la liste complète
        </Link>
      </div>

      {/* Le total peut dépasser ce que l'API renvoie : le dire, plutôt que de
          laisser croire que la liste est complète. */}
      {deplie && liste.total > liste.items.length ? (
        <p className="mt-2 text-xs text-amber-800">
          {liste.items.length} affichés sur {liste.total}. Les suivants apparaîtront une fois
          ceux-ci traités.
        </p>
      ) : null}

      {state.error ? (
        <div className="mt-2">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}

      {/* Le geste réel est groupé : on va tout retirer, puis on revient le
          dire. Un bouton par ligne seulement, à cinquante lignes, fait
          abandonner la liste. Il ne porte que ce qui est affiché. */}
      {liste.items.length > 1 ? (
        <form action={action} className="mt-3">
          {liste.items.map((item) => (
            <input key={item.id} type="hidden" name="productId" value={item.id} />
          ))}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? '…' : `${geste} — les ${liste.items.length}`}
          </button>
        </form>
      ) : null}
    </section>
  );
}

export function Removals({ toDelist, toPull }: { toDelist?: RemovalList; toPull?: RemovalList }) {
  // Rien à faire : pas de carte vide. Une corvée finie doit disparaître, sinon
  // l'écran garde un bandeau d'alerte permanent qu'on finit par ne plus voir.
  if ((toDelist?.total ?? 0) + (toPull?.total ?? 0) === 0) return null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {toDelist?.total ? (
        <Liste
          title="Annonces à retirer du site"
          hint="Vendus en boutique, mais toujours publiés en ligne."
          geste="Tout dépublier"
          liste={toDelist}
        />
      ) : null}
      {toPull?.total ? (
        <Liste
          title="Vêtements à décrocher"
          hint="Vendus sur le site, mais toujours en boutique."
          geste="Tout décrocher"
          liste={toPull}
        />
      ) : null}
    </div>
  );
}
