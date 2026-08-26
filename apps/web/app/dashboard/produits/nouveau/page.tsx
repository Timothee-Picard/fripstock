import { FormulaireProduit } from './formulaire';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { Boutique, CategorieArbre } from '@/lib/types';

export default async function PageNouveauProduit() {
  await exigerSession();
  const [arbre, boutiques] = await Promise.all([
    appelApi<CategorieArbre[]>('/categories/arbre'),
    appelApi<Boutique[]>('/boutiques'),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Nouveau produit</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les attributs demandés dépendent de la catégorie choisie. Le statut initial est celui par
          défaut de l&apos;entreprise.
        </p>
      </div>
      <FormulaireProduit arbre={arbre} boutiques={boutiques} />
    </div>
  );
}
