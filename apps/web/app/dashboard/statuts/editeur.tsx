'use client';

import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  creerStatut,
  definirParDefaut,
  enregistrerFlux,
  modifierStatut,
  supprimerStatut,
} from './actions';
import { NoeudStatutVue, type NoeudStatut } from './noeud-statut';
import { Alerte } from '@/components/champ';
import type { Statut } from '@/lib/types';

const TYPES_NOEUDS = { statut: NoeudStatutVue };
const COLONNE = 260;
const LIGNE = 130;

const FLAGS = [
  {
    cle: 'estVente',
    titre: 'Vente',
    aide: "Passer un produit à ce statut, c'est le vendre : le prix encaissé est demandé et compte dans le chiffre d'affaires.",
  },
  {
    cle: 'bloqueVente',
    titre: 'Invendable ensuite',
    aide: 'Un produit dans ce statut ne pourra plus jamais être vendu ni voir son prix encaissé modifié.',
  },
  {
    cle: 'sortStock',
    titre: 'Sort du stock',
    aide: "Le produit ne compte plus dans l'inventaire actif ni dans les statistiques.",
  },
] as const;

function bouton(variante: 'principal' | 'secondaire' | 'danger' = 'secondaire') {
  const styles = {
    principal: 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400',
    secondaire: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'border border-red-200 text-red-700 hover:bg-red-50 disabled:text-red-300',
  }[variante];
  return `rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${styles}`;
}

export function EditeurStatuts({ statuts }: { statuts: Statut[] }) {
  const router = useRouter();
  const [enAttente, demarrer] = useTransition();
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [modifie, setModifie] = useState(false);
  const [panneauAjout, setPanneauAjout] = useState(false);

  const [noeuds, setNoeuds, onNoeudsChange] = useNodesState<NoeudStatut>(
    statuts.map((s, i) => ({
      id: s.id,
      type: 'statut' as const,
      // Les statuts se suppriment par la barre d'outils, avec confirmation :
      // la touche Suppr ne doit emporter que des flèches.
      deletable: false,
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

  // Le serveur renvoie une nouvelle liste après chaque action structurelle :
  // on resynchronise le canevas dessus.
  const signature = statuts.map((s) => `${s.id}:${s.nom}:${s.couleur}:${s.estDefaut}`).join('|');
  const derniereSignature = useRef(signature);
  useEffect(() => {
    if (derniereSignature.current === signature) return;
    derniereSignature.current = signature;
    setNoeuds((precedents) => {
      const connus = new Map(precedents.map((n) => [n.id, n.position]));
      return statuts.map((s, i) => ({
        id: s.id,
        type: 'statut' as const,
        deletable: false,
        position: connus.get(s.id) ?? {
          x: s.positionX ?? (i % 3) * COLONNE,
          y: s.positionY ?? Math.floor(i / 3) * LIGNE,
        },
        data: { statut: s },
      }));
    });
  }, [signature, statuts, setNoeuds]);

  const selectionNoeud = noeuds.find((n) => n.selected);
  const selectionArete = aretes.find((a) => a.selected);
  const statutSelectionne = selectionNoeud?.data.statut;

  const nomsParId = useMemo(() => new Map(statuts.map((s) => [s.id, s.nom])), [statuts]);

  const connecter = useCallback(
    (connexion: Connection) => {
      if (connexion.source === connexion.target) return;
      setModifie(true);
      setAretes((precedentes) =>
        addEdge(
          {
            ...connexion,
            id: `${connexion.source}->${connexion.target}`,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          precedentes,
        ),
      );
    },
    [setAretes],
  );

  /** Enregistre positions et flèches, puis exécute une action structurelle. */
  function agir(action: () => Promise<{ erreur?: string; succes?: string }>) {
    demarrer(async () => {
      setEtat({});
      const flux = await enregistrerFlux(
        noeuds.map((n) => ({ id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
        aretes.map((a) => ({ sourceId: a.source, cibleId: a.target })),
      );
      if (flux.erreur) {
        setEtat(flux);
        return;
      }
      setModifie(false);
      setEtat(await action());
      router.refresh();
    });
  }

  function enregistrer() {
    demarrer(async () => {
      setEtat(
        await enregistrerFlux(
          noeuds.map((n) => ({
            id: n.id,
            x: Math.round(n.position.x),
            y: Math.round(n.position.y),
          })),
          aretes.map((a) => ({ sourceId: a.source, cibleId: a.target })),
        ),
      );
      setModifie(false);
      router.refresh();
    });
  }

  function supprimerSelection() {
    if (selectionArete) {
      setAretes((p) => p.filter((a) => a.id !== selectionArete.id));
      setModifie(true);
      return;
    }
    if (!statutSelectionne) return;
    if (!confirm(`Supprimer le statut « ${statutSelectionne.nom} » ?`)) return;
    const donnees = new FormData();
    donnees.set('id', statutSelectionne.id);
    agir(() => supprimerStatut({}, donnees));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* --- Barre d'outils ------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setPanneauAjout(!panneauAjout)}
          className={bouton('principal')}
        >
          + Ajouter un statut
        </button>

        <span className="h-6 w-px bg-slate-200" aria-hidden />

        {selectionArete ? (
          <>
            <span className="text-sm text-slate-700">
              Flèche <strong>{nomsParId.get(selectionArete.source)}</strong> →{' '}
              <strong>{nomsParId.get(selectionArete.target)}</strong>
            </span>
            <button type="button" onClick={supprimerSelection} className={bouton('danger')}>
              Supprimer la flèche
            </button>
          </>
        ) : statutSelectionne ? (
          <ChampsStatut
            statut={statutSelectionne}
            enAttente={enAttente}
            onModifier={(nom, couleur) => {
              const d = new FormData();
              d.set('id', statutSelectionne.id);
              d.set('nom', nom);
              d.set('couleur', couleur);
              agir(() => modifierStatut({}, d));
            }}
            onParDefaut={() => {
              const d = new FormData();
              d.set('id', statutSelectionne.id);
              agir(() => definirParDefaut({}, d));
            }}
            onSupprimer={supprimerSelection}
          />
        ) : (
          <span className="text-sm text-slate-600">
            Cliquez sur un statut ou une flèche pour le modifier.
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {modifie ? (
            <span className="text-xs text-amber-800">Modifications non enregistrées</span>
          ) : null}
          <button
            type="button"
            onClick={enregistrer}
            disabled={enAttente || !modifie}
            className={bouton('principal')}
          >
            {enAttente ? 'Enregistrement…' : 'Enregistrer le flux'}
          </button>
        </div>
      </div>

      {panneauAjout ? (
        <PanneauAjout
          enAttente={enAttente}
          onAnnuler={() => setPanneauAjout(false)}
          onCreer={(donnees) => {
            setPanneauAjout(false);
            agir(() => creerStatut({}, donnees));
          }}
        />
      ) : null}

      {etat.erreur ? <Alerte>{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="info">{etat.succes}</Alerte> : null}

      {aretes.length === 0 ? (
        <Alerte ton="info">
          Aucune flèche : tous les passages restent permis. Dès la première flèche enregistrée,
          seuls les chemins tracés seront acceptés.
        </Alerte>
      ) : null}

      {/* --- Canevas -------------------------------------------------------- */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <ReactFlow
          nodes={noeuds}
          edges={aretes}
          onNodesChange={(changements) => {
            if (changements.some((c) => c.type === 'position' && c.dragging === false)) {
              setModifie(true);
            }
            onNoeudsChange(changements);
          }}
          onEdgesChange={(changements) => {
            if (changements.some((c) => c.type === 'remove')) setModifie(true);
            onAretesChange(changements);
          }}
          onConnect={connecter}
          nodeTypes={TYPES_NOEUDS}
          deleteKeyCode={['Delete', 'Backspace']}
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-white" />
        </ReactFlow>
      </div>

      <p className="text-xs text-slate-600">
        Tirez un trait du point droit d&apos;un statut vers le point gauche d&apos;un autre pour
        autoriser ce passage. Sélectionnez une flèche puis Suppr — ou le bouton — pour la retirer.
        Les règles de comportement s&apos;appliquent en plus du flux : elles ne se contournent pas
        en traçant une flèche.
      </p>
    </div>
  );
}

function ChampsStatut({
  statut,
  enAttente,
  onModifier,
  onParDefaut,
  onSupprimer,
}: {
  statut: Statut;
  enAttente: boolean;
  onModifier: (nom: string, couleur: string) => void;
  onParDefaut: () => void;
  onSupprimer: () => void;
}) {
  const [nom, setNom] = useState(statut.nom);
  const [couleur, setCouleur] = useState(statut.couleur);

  // Le composant est remonté à chaque changement de sélection grâce à la clé
  // posée par l'appelant, donc les champs repartent toujours du statut visé.
  const change = nom !== statut.nom || couleur !== statut.couleur;

  return (
    <div key={statut.id} className="flex flex-wrap items-center gap-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        aria-label="Nom du statut"
        className="w-44 rounded-md border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900"
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
      <button type="button" disabled={enAttente} onClick={onSupprimer} className={bouton('danger')}>
        Supprimer
      </button>
    </div>
  );
}

function PanneauAjout({
  enAttente,
  onAnnuler,
  onCreer,
}: {
  enAttente: boolean;
  onAnnuler: () => void;
  onCreer: (donnees: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreer(new FormData(e.currentTarget));
      }}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Nom</span>
          <input
            name="nom"
            required
            autoFocus
            className="w-56 rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-800">Couleur</span>
          <input
            type="color"
            name="couleur"
            defaultValue="#6b7280"
            className="h-9 w-16 cursor-pointer rounded-md border border-slate-400 bg-white p-1"
          />
        </label>
      </div>

      <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <legend className="px-1 text-sm font-medium text-slate-800">Comportement</legend>
        <p className="mb-2 text-xs text-slate-600">
          Ces réglages se fixent maintenant et ne pourront plus être changés : des produits
          s&apos;appuieront dessus. Ils valent quel que soit le nom donné au statut.
        </p>
        <div className="space-y-2">
          {FLAGS.map((f) => (
            <label key={f.cle} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                name={f.cle}
                className="mt-0.5 size-4 shrink-0 rounded border-slate-400 accent-slate-900"
              />
              <span>
                <span className="font-medium text-slate-800">{f.titre}</span>
                <span className="block text-xs text-slate-600">{f.aide}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" disabled={enAttente} className={bouton('principal')}>
          {enAttente ? 'Création…' : 'Créer le statut'}
        </button>
        <button type="button" onClick={onAnnuler} className={bouton()}>
          Annuler
        </button>
      </div>
    </form>
  );
}
