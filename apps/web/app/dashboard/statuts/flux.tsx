'use client';

import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState } from 'react';
import { enregistrerFlux } from './actions';
import { Alerte, Bouton } from '@/components/champ';
import type { Statut } from '@/lib/types';

/** Disposition en colonnes pour les statuts jamais déplacés. */
const COLONNE = 220;
const LIGNE = 110;

type DonneesStatut = { statut: Statut };
type NoeudStatut = Node<DonneesStatut, 'statut'>;

function NoeudStatutVue({ data }: NodeProps<NoeudStatut>) {
  const { statut } = data;
  const marques = [
    statut.estDefaut ? 'défaut' : null,
    statut.estVente ? 'vente' : null,
    statut.bloqueVente ? 'invendable' : null,
    statut.sortStock ? 'hors stock' : null,
  ].filter(Boolean);

  return (
    <div
      className="min-w-36 rounded-lg border-2 bg-white shadow-sm"
      style={{ borderColor: statut.couleur }}
    >
      {/* Une poignée de chaque côté : on tire depuis la droite vers la gauche
          du statut suivant pour créer une flèche. */}
      <Handle type="target" position={Position.Left} className="!size-2.5 !bg-slate-500" />
      <div
        className="rounded-t px-3 py-1.5 text-sm font-medium text-white"
        style={{ backgroundColor: statut.couleur }}
      >
        {statut.nom}
      </div>
      <div className="px-3 py-1.5 text-[11px] leading-tight text-slate-600">
        {marques.length > 0 ? marques.join(' · ') : 'ordinaire'}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2.5 !bg-slate-500" />
    </div>
  );
}

const TYPES_NOEUDS = { statut: NoeudStatutVue };

export function SchemaFlux({ statuts }: { statuts: Statut[] }) {
  const [noeuds, setNoeuds, onNoeudsChange] = useNodesState<NoeudStatut>(
    statuts.map((s, i) => ({
      id: s.id,
      type: 'statut' as const,
      // Position mémorisée, sinon disposition automatique en grille de 3.
      position: {
        x: s.positionX ?? (i % 3) * COLONNE,
        y: s.positionY ?? Math.floor(i / 3) * LIGNE,
      },
      data: { statut: s },
    })),
  );

  const [aretes, setAretes, onAretesChange] = useEdgesState<Edge>(
    statuts.flatMap((s) =>
      // `ciblesAutorisees` vaut « tout » quand aucun flux n'est défini : on ne
      // dessinerait alors que du bruit.
      s.fluxDefini
        ? s.ciblesAutorisees.map((cibleId) => ({
            id: `${s.id}->${cibleId}`,
            source: s.id,
            target: cibleId,
            markerEnd: { type: MarkerType.ArrowClosed },
          }))
        : [],
    ),
  );

  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, setEnCours] = useState(false);

  const connecter = useCallback(
    (connexion: Connection) => {
      if (connexion.source === connexion.target) return;
      setAretes((precedentes) =>
        addEdge({ ...connexion, markerEnd: { type: MarkerType.ArrowClosed } }, precedentes),
      );
    },
    [setAretes],
  );

  async function enregistrer() {
    setEnCours(true);
    setEtat({});
    const resultat = await enregistrerFlux(
      noeuds.map((n) => ({ id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
      aretes.map((a) => ({ sourceId: a.source, cibleId: a.target })),
    );
    setEtat(resultat);
    setEnCours(false);
  }

  function toutEffacer() {
    setAretes([]);
  }

  function disposerAutomatiquement() {
    setNoeuds((precedents) =>
      precedents.map((n, i) => ({
        ...n,
        position: { x: (i % 3) * COLONNE, y: Math.floor(i / 3) * LIGNE },
      })),
    );
  }

  const fluxDefini = aretes.length > 0;

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-900">Flux des statuts</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Déplacez les statuts, puis tirez un trait du point droit de l&apos;un vers le point
            gauche d&apos;un autre pour autoriser ce passage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Bouton type="button" variante="secondaire" onClick={disposerAutomatiquement}>
            Réorganiser
          </Bouton>
          <Bouton type="button" variante="secondaire" onClick={toutEffacer} disabled={!fluxDefini}>
            Effacer les flèches
          </Bouton>
          <Bouton type="button" onClick={() => void enregistrer()} disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Enregistrer le flux'}
          </Bouton>
        </div>
      </div>

      {fluxDefini ? (
        <Alerte ton="info">
          Seuls les passages tracés seront autorisés. Un statut sans flèche sortante devient un
          point d&apos;arrivée : aucun produit n&apos;en repartira.
        </Alerte>
      ) : (
        <Alerte ton="info">
          Aucune flèche : tous les passages restent permis. Dès la première flèche enregistrée,
          seuls les chemins tracés seront acceptés.
        </Alerte>
      )}

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      <div className="h-[420px] rounded-md border border-slate-200 bg-slate-50">
        <ReactFlow
          nodes={noeuds}
          edges={aretes}
          onNodesChange={onNoeudsChange}
          onEdgesChange={onAretesChange}
          onConnect={connecter}
          nodeTypes={TYPES_NOEUDS}
          fitView
          proOptions={{ hideAttribution: false }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <p className="text-xs text-slate-600">
        Sélectionnez une flèche et appuyez sur Suppr pour la retirer. Les règles de comportement
        (vente, invendable ensuite) s&apos;appliquent en plus du flux : elles ne peuvent pas être
        contournées en traçant une flèche.
      </p>
    </section>
  );
}
