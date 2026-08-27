'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { sellBasket } from './products/actions';
import { Alert, Button } from '@/components/field';
import { splitCost } from '@/lib/lot-split';
import { euros, eurosNumber, type ProductSummary } from '@/lib/types';

/**
 * Comptoir : plusieurs articles passent à vendu d'un coup.
 *
 * Le client pose cinq vêtements, il faut que le stock suive. Le point d'entrée
 * est la référence lue sur l'étiquette — c'est ce qu'on a en main, et une
 * douchette QR se contentera de la taper à notre place le jour venu. Une
 * référence exacte ajoute l'article sans un clic ; toute autre saisie propose
 * une liste, pour l'étiquette arrachée.
 *
 * La remise se pose sur le total : elle se répartit alors au prorata des prix
 * affichés, exactement comme le prix d'un lot acheté se répartit entre ses
 * articles. Chaque ligne reste modifiable à la main, pour négocier un seul
 * vêtement.
 */

interface Ligne {
  product: ProductSummary;
  /** Prix encaissé, en saisie libre. Vide = prix de l'étiquette. */
  prix: string;
}

function nombre(valeur: string | null): number {
  const n = Number(String(valeur ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const CHAMP =
  'w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

export function Counter({ shopId, shopName }: { shopId?: string; shopName?: string }) {
  const [state, action, pending] = useActionState(sellBasket, {});
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [saisie, setSaisie] = useState('');
  const [propositions, setPropositions] = useState<ProductSummary[]>([]);
  const [cherche, setCherche] = useState(false);
  const [remise, setRemise] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  /** Proposition surlignée au clavier. -1 : aucune. */
  const [survole, setSurvole] = useState(-1);

  // Le panier se vide au succès, et le curseur retourne dans le champ : au
  // comptoir, le client suivant attend déjà.
  const [dernierSucces, setDernierSucces] = useState<string | undefined>(undefined);
  if (state.token && state.token !== dernierSucces) {
    setDernierSucces(state.token);
    setLignes([]);
    setRemise('');
    setSaisie('');
    setPropositions([]);
  }

  useEffect(() => {
    champ.current?.focus();
  }, [dernierSucces]);

  const sousTotal = useMemo(
    () =>
      Math.round(
        lignes.reduce(
          (t, l) => t + (l.prix === '' ? nombre(l.product.salePrice) : nombre(l.prix)),
          0,
        ) * 100,
      ) / 100,
    [lignes],
  );

  /**
   * Prix effectivement encaissés.
   *
   * Sans remise, chaque ligne garde son prix. Avec, le total saisi se répartit
   * au prorata — la somme retombe alors exactement sur ce que le client paie.
   */
  const encaisses = useMemo(() => {
    const bruts = lignes.map((l) => (l.prix === '' ? nombre(l.product.salePrice) : nombre(l.prix)));
    const total = nombre(remise);
    if (remise === '' || total <= 0) return bruts;
    return splitCost(total, bruts);
  }, [lignes, remise]);

  const total = Math.round(encaisses.reduce((t, p) => t + p, 0) * 100) / 100;

  function ajouter(product: ProductSummary) {
    setErreur(null);
    setSaisie('');
    setPropositions([]);
    setSurvole(-1);
    setLignes((current) =>
      current.some((l) => l.product.id === product.id)
        ? current
        : [...current, { product, prix: '' }],
    );
    champ.current?.focus();
  }

  /** Articles vendables correspondant à la saisie, dans la boutique choisie. */
  async function rechercher(terme: string, signal?: AbortSignal): Promise<ProductSummary[]> {
    const params = new URLSearchParams({ q: terme });
    if (shopId) params.set('shopId', shopId);
    const reponse = await fetch(`/api/products/search?${params.toString()}`, { signal });
    return reponse.ok ? ((await reponse.json()) as ProductSummary[]) : [];
  }

  // Autocomplétion : les propositions suivent la frappe, après une courte
  // pause. Sans elle, chaque caractère lancerait une requête.
  useEffect(() => {
    const terme = saisie.trim();
    if (terme.length < 2) return;
    const controller = new AbortController();
    const minuteur = setTimeout(() => {
      rechercher(terme, controller.signal)
        .then(setPropositions)
        .catch(() => {
          // Requête annulée par la frappe suivante, ou API indisponible : la
          // validation par Entrée reste possible et dira ce qui ne va pas.
        });
    }, 200);
    return () => {
      clearTimeout(minuteur);
      controller.abort();
    };
    // `rechercher` est stable pour un `shopId` donné.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, shopId]);

  // Les propositions ne s'affichent qu'à partir de deux caractères. C'est
  // dérivé du champ plutôt que remis à zéro dans l'effet : effacer sa saisie
  // doit vider la liste tout de suite, sans attendre un rendu de plus.
  // Ce qui est déjà au panier disparaît des propositions : le proposer une
  // seconde fois ne mènerait à rien, et Entrée dessus semblerait sans effet.
  const auPanier = new Set(lignes.map((l) => l.product.id));
  const affichees = saisie.trim().length < 2 ? [] : propositions.filter((p) => !auPanier.has(p.id));
  // La liste peut rétrécir sous le curseur, entre deux requêtes : on ramène
  // alors la sélection à rien plutôt que de désigner un article au hasard.
  const actif = survole >= affichees.length ? -1 : survole;

  // Une liste plus longue que l'écran doit suivre le clavier, sinon la
  // sélection disparaît sous le bord.
  useEffect(() => {
    if (actif < 0) return;
    // jsdom n'implémente pas `scrollIntoView` : son absence ne doit pas faire
    // échouer les tests.
    liste.current?.children[actif]?.scrollIntoView?.({ block: 'nearest' });
  }, [actif]);

  /**
   * Flèches, Entrée, Échap dans le champ.
   *
   * Le comptoir se tient au clavier : on descend dans les propositions et on
   * valide sans lâcher les mains, comme dans n'importe quelle liste de
   * complétion.
   */
  function auClavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (affichees.length === 0) return;
      e.preventDefault();
      const pas = e.key === 'ArrowDown' ? 1 : -1;
      // Le champ lui-même est un cran, avant la première proposition : on
      // raisonne donc sur `n + 1` dans [0, longueur], et la liste boucle —
      // arrivé en bas, la flèche suivante ramène au champ, puis en tête.
      const crans = affichees.length + 1;
      setSurvole((n) => ((n + 1 + pas + crans) % crans) - 1);
      return;
    }
    if (e.key === 'Escape' && affichees.length > 0) {
      e.preventDefault();
      setPropositions([]);
      setSurvole(-1);
    }
  }

  /**
   * Validation au clavier.
   *
   * Une référence exacte entre sans un clic — c'est le geste du comptoir, et
   * demain celui de la douchette. Une seule proposition entre aussi : hésiter
   * devant une liste d'un élément n'aurait pas de sens.
   */
  async function valider(terme: string) {
    setCherche(true);
    setErreur(null);
    try {
      const trouves = propositions.length > 0 ? propositions : await rechercher(terme);
      const libres = trouves.filter((p) => !auPanier.has(p.id));

      const exact = libres.find((p) => p.reference?.toLowerCase() === terme.toLowerCase());
      if (exact) return ajouter(exact);
      if (libres.length === 1) return ajouter(libres[0]);
      if (libres.length === 0) {
        // Distinguer les deux : « rien ne correspond » et « c'est déjà pris »
        // demandent au vendeur deux gestes différents.
        setErreur(
          trouves.length > 0
            ? `« ${terme} » est déjà dans le panier.`
            : `Aucun article vendable ne correspond à « ${terme} ».`,
        );
        setPropositions([]);
        return;
      }
      setPropositions(trouves);
    } catch {
      setErreur('Recherche indisponible.');
    } finally {
      setCherche(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900">Vendre des articles</h2>
        <p className="text-xs text-slate-600">
          Référence de l&apos;étiquette, ou nom d&apos;article —{' '}
          {shopName ?? 'toutes les boutiques'}.
        </p>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // Une proposition surlignée l'emporte : c'est celle que l'œil suit.
          if (actif >= 0) return ajouter(affichees[actif]);
          const terme = saisie.trim();
          if (terme) void valider(terme);
        }}
      >
        <input
          ref={champ}
          autoFocus
          value={saisie}
          // Les espaces sautent à la frappe : une référence copiée depuis un
          // tableur en traîne souvent, et une douchette en ajoute parfois.
          onChange={(e) => {
            setSaisie(e.target.value.replace(/\s+/g, ''));
            setSurvole(-1);
          }}
          onKeyDown={auClavier}
          placeholder="A-0042"
          aria-label="Référence ou nom de l'article"
          role="combobox"
          aria-expanded={affichees.length > 0}
          aria-controls="comptoir-propositions"
          aria-autocomplete="list"
          aria-activedescendant={actif >= 0 ? `comptoir-option-${actif}` : undefined}
          className={`${CHAMP} max-w-xs font-mono`}
        />
        <Button type="submit" variant="secondary" disabled={cherche || saisie.trim() === ''}>
          {cherche ? '…' : 'Ajouter'}
        </Button>
      </form>

      {erreur ? <p className="mt-2 text-sm text-red-700">{erreur}</p> : null}

      {affichees.length > 0 ? (
        <ul
          ref={liste}
          id="comptoir-propositions"
          role="listbox"
          className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200"
        >
          {affichees.map((p, index) => (
            <li
              key={p.id}
              id={`comptoir-option-${index}`}
              role="option"
              aria-selected={index === actif}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => ajouter(p)}
                onMouseEnter={() => setSurvole(index)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                  index === actif ? 'bg-sky-50' : 'hover:bg-slate-50'
                }`}
              >
                <span>
                  <span className="font-mono text-xs text-slate-600">{p.reference}</span> {p.name}
                  <span className="ml-2 text-xs text-slate-500">
                    {p.category.name} · {p.shop?.name ?? 'Stock central'} · {p.status.name}
                  </span>
                </span>
                <span className="shrink-0 text-slate-700">{euros(p.salePrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {state.error ? (
        <div className="mt-3">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}
      {state.success ? (
        <div className="mt-3">
          <Alert tone="info">{state.success}</Alert>
        </div>
      ) : null}

      {lignes.length > 0 ? (
        <form action={action} className="mt-4 space-y-3">
          {lignes.map((ligne, index) => (
            <input
              key={ligne.product.id}
              type="hidden"
              name="line"
              value={`${ligne.product.id}:${encaisses[index]}`}
            />
          ))}

          <table className="w-full text-sm">
            <tbody>
              {lignes.map((ligne, index) => {
                const brut =
                  ligne.prix === '' ? nombre(ligne.product.salePrice) : nombre(ligne.prix);
                const remisee = remise !== '' && encaisses[index] !== brut;
                return (
                  <tr key={ligne.product.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-2 font-mono text-xs text-slate-600">
                      {ligne.product.reference}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-900">{ligne.product.name}</td>
                    <td className="w-28 py-1.5">
                      <input
                        inputMode="decimal"
                        value={ligne.prix}
                        placeholder={nombre(ligne.product.salePrice).toFixed(2).replace('.', ',')}
                        onChange={(e) =>
                          setLignes((current) =>
                            current.map((l, i) =>
                              i === index ? { ...l, prix: e.target.value } : l,
                            ),
                          )
                        }
                        aria-label={`Prix de ${ligne.product.name}`}
                        className={`${CHAMP} py-1 text-right`}
                      />
                    </td>
                    <td className="w-24 py-1.5 pl-2 text-right text-slate-600">
                      {remisee ? eurosNumber(encaisses[index]) : null}
                    </td>
                    <td className="w-8 py-1.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setLignes((current) => current.filter((_, i) => i !== index))
                        }
                        aria-label={`Retirer ${ligne.product.name}`}
                        className="rounded px-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-800">Total négocié (€)</span>
              <input
                inputMode="decimal"
                value={remise}
                onChange={(e) => setRemise(e.target.value)}
                placeholder={sousTotal.toFixed(2).replace('.', ',')}
                aria-label="Total négocié"
                className={`${CHAMP} w-32 text-right`}
              />
              <span className="mt-1 block text-xs text-slate-600">
                Réparti au prorata sur les articles.
              </span>
            </label>

            <p role="status" className="text-sm text-slate-700">
              <strong>{lignes.length}</strong> article{lignes.length > 1 ? 's' : ''} ·{' '}
              <strong className="text-lg font-semibold">{eurosNumber(total)}</strong>
              {remise !== '' && total !== sousTotal ? (
                <span className="ml-1.5 text-slate-500 line-through">{eurosNumber(sousTotal)}</span>
              ) : null}
            </p>

            <Button type="submit" disabled={pending}>
              {pending
                ? 'Enregistrement…'
                : `Valider ${lignes.length} vente${lignes.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
