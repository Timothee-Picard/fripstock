'use client';

import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { AreteFlux } from './arete-flux';
import { definirParDefaut, modifierStatut } from './actions';
import { NoeudStatutVue } from './noeud-statut';
import { Alerte } from '@/components/champ';
import type { Statut } from '@/lib/types';

const TYPES_NOEUDS = { statut: NoeudStatutVue };
const TYPES_ARETES = { flux: AreteFlux };

function bouton(variante: 'principal' | 'secondaire' = 'secondaire') {
  const styles = {
    principal: 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400',
    secondaire: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  }[variante];
  return `rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${styles}`;
}

/**
 * Schéma du cycle de vie des produits.
 *
 * Le graphe est **consultable, pas modifiable** : les six statuts et leurs
 * transitions sont posés à la création de l'entreprise. Autoriser l'ajout d'un
 * statut le laisserait sans aucune flèche, donc inatteignable ; le flux perdrait
 * sa cohérence sans que rien ne le signale.
 *
 * Reste ajustable ce qui ne touche pas à la structure : le libellé, la couleur,
 * et le statut attribué par défaut à un produit neuf.
 */
export function EditeurStatuts({ statuts }: { statuts: Statut[] }) {
  const router = useRouter();
  const [enAttente, demarrer] = useTransition();
  const [etat, setEtat] = useState<EtatLocal>({});
  const [selectionId, setSelectionId] = useState<string | null>(null);

  const noeuds = useMemo<Node[]>(
    () =>
      statuts.map((s, i) => ({
        id: s.id,
        type: 'statut',
        position: { x: s.positionX ?? (i % 3) * 260, y: s.positionY ?? Math.floor(i / 3) * 130 },
        data: { statut: s },
        selected: s.id === selectionId,
        draggable: false,
        connectable: false,
        deletable: false,
      })),
    [statuts, selectionId],
  );

  const aretes = useMemo<Edge[]>(
    () =>
      statuts.flatMap((s) =>
        s.fluxDefini
          ? s.ciblesAutorisees.map((cibleId) => ({
              id: `${s.id}->${cibleId}`,
              source: s.id,
              target: cibleId,
              type: 'flux',
              selectable: false,
              deletable: false,
              markerEnd: { type: MarkerType.ArrowClosed },
            }))
          : [],
      ),
    [statuts],
  );

  const selection = statuts.find((s) => s.id === selectionId);

  function agir(donnees: FormData, action: typeof modifierStatut) {
    demarrer(async () => {
      setEtat(await action({}, donnees));
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {selection ? (
          <ChampsStatut
            key={selection.id}
            statut={selection}
            enAttente={enAttente}
            onModifier={(nom, couleur) => {
              const d = new FormData();
              d.set('id', selection.id);
              d.set('nom', nom);
              d.set('couleur', couleur);
              agir(d, modifierStatut);
            }}
            onParDefaut={() => {
              const d = new FormData();
              d.set('id', selection.id);
              agir(d, definirParDefaut);
            }}
          />
        ) : (
          <span className="text-sm text-slate-600">
            Cliquez sur un statut pour changer son libellé, sa couleur, ou en faire le statut par
            défaut.
          </span>
        )}
      </div>

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <ReactFlow
          nodes={noeuds}
          edges={aretes}
          nodeTypes={TYPES_NOEUDS}
          edgeTypes={TYPES_ARETES}
          onNodeClick={(_, noeud) => setSelectionId(noeud.id)}
          onPaneClick={() => setSelectionId(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <p className="text-xs text-slate-600">
        Les flèches disent quels passages sont autorisés. Ce cycle est posé à la création de
        l&apos;entreprise et n&apos;est pas modifiable : un statut ajouté n&apos;aurait aucune
        flèche et resterait inatteignable. Les règles de comportement — vente, invendable ensuite —
        s&apos;appliquent en plus du flux.
      </p>
    </div>
  );
}

interface EtatLocal {
  erreur?: string;
  succes?: string;
}

function ChampsStatut({
  statut,
  enAttente,
  onModifier,
  onParDefaut,
}: {
  statut: Statut;
  enAttente: boolean;
  onModifier: (nom: string, couleur: string) => void;
  onParDefaut: () => void;
}) {
  const [nom, setNom] = useState(statut.nom);
  const [couleur, setCouleur] = useState(statut.couleur);
  const change = nom.trim() !== statut.nom || couleur !== statut.couleur;

  const marques = [
    statut.estVente ? 'vente' : null,
    statut.bloqueVente ? 'invendable ensuite' : null,
    statut.sortStock ? 'sort du stock' : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        aria-label="Libellé du statut"
        className="w-48 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900"
      />
      <input
        type="color"
        value={couleur}
        onChange={(e) => setCouleur(e.target.value)}
        aria-label="Couleur du statut"
        className="h-8 w-12 cursor-pointer rounded-md border border-slate-400 bg-white p-1"
      />
      <button
        type="button"
        disabled={!change || enAttente}
        onClick={() => onModifier(nom.trim(), couleur)}
        className={bouton('principal')}
      >
        Appliquer
      </button>
      {statut.estDefaut ? (
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">★ par défaut</span>
      ) : (
        <button type="button" disabled={enAttente} onClick={onParDefaut} className={bouton()}>
          Définir par défaut
        </button>
      )}
      <span className="text-xs text-slate-600">
        Comportement figé : {marques.length > 0 ? marques.join(' · ') : 'ordinaire'}
      </span>
    </div>
  );
}
