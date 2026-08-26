'use client';

import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { FlowEdge } from './flow-edge';
import { setDefaultStatus, updateStatus } from './actions';
import { StatusNodeView } from './status-node';
import { Alert } from '@/components/field';
import type { Status } from '@/lib/types';

const TYPES_NOEUDS = { status: StatusNodeView };
const TYPES_ARETES = { flow: FlowEdge };

function button(variant: 'primary' | 'secondary' = 'secondary') {
  const styles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400',
    secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  }[variant];
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
export function StatusEditor({ statuses }: { statuses: Status[] }) {
  const router = useRouter();
  const [enAttente, start] = useTransition();
  const [state, setEtat] = useState<LocalState>({});
  const [selectionId, setSelectionId] = useState<string | null>(null);

  const nodes = useMemo<Node[]>(
    () =>
      statuses.map((s, i) => ({
        id: s.id,
        type: 'status',
        position: { x: s.positionX ?? (i % 3) * 260, y: s.positionY ?? Math.floor(i / 3) * 130 },
        data: { status: s },
        selected: s.id === selectionId,
        draggable: false,
        connectable: false,
        deletable: false,
      })),
    [statuses, selectionId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      statuses.flatMap((s) =>
        s.flowDefined
          ? s.allowedTargets.map((cibleId) => ({
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
    [statuses],
  );

  const selection = statuses.find((s) => s.id === selectionId);

  function agir(data: FormData, action: typeof updateStatus) {
    start(async () => {
      setEtat(await action({}, data));
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {selection ? (
          <StatusFields
            key={selection.id}
            status={selection}
            enAttente={enAttente}
            onModifier={(name, color) => {
              const d = new FormData();
              d.set('id', selection.id);
              d.set('name', name);
              d.set('color', color);
              agir(d, updateStatus);
            }}
            onParDefaut={() => {
              const d = new FormData();
              d.set('id', selection.id);
              agir(d, setDefaultStatus);
            }}
          />
        ) : (
          <span className="text-sm text-slate-600">
            Cliquez sur un statut pour changer son libellé, sa couleur, ou en faire le statut par
            défaut.
          </span>
        )}
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="info">{state.success}</Alert> : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={TYPES_NOEUDS}
          edgeTypes={TYPES_ARETES}
          onNodeClick={(_, node) => setSelectionId(node.id)}
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

interface LocalState {
  error?: string;
  success?: string;
}

function StatusFields({
  status,
  enAttente,
  onModifier,
  onParDefaut,
}: {
  status: Status;
  enAttente: boolean;
  onModifier: (name: string, color: string) => void;
  onParDefaut: () => void;
}) {
  const [name, setNom] = useState(status.name);
  const [color, setCouleur] = useState(status.color);
  const change = name.trim() !== status.name || color !== status.color;

  const brands = [
    status.isSale ? 'vente' : null,
    status.blocksSale ? 'invendable ensuite' : null,
    status.leavesStock ? 'sort du stock' : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setNom(e.target.value)}
        aria-label="Libellé du statut"
        className="w-48 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900"
      />
      <input
        type="color"
        value={color}
        onChange={(e) => setCouleur(e.target.value)}
        aria-label="Couleur du statut"
        className="h-8 w-12 cursor-pointer rounded-md border border-slate-400 bg-white p-1"
      />
      <button
        type="button"
        disabled={!change || enAttente}
        onClick={() => onModifier(name.trim(), color)}
        className={button('primary')}
      >
        Appliquer
      </button>
      {status.isDefault ? (
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">★ par défaut</span>
      ) : (
        <button type="button" disabled={enAttente} onClick={onParDefaut} className={button()}>
          Définir par défaut
        </button>
      )}
      <span className="text-xs text-slate-600">
        Comportement figé : {brands.length > 0 ? brands.join(' · ') : 'ordinaire'}
      </span>
    </div>
  );
}
