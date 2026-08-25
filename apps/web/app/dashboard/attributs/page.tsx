import { CarteAttribut, DepuisModele, FormulaireCreation } from './formulaires';
import { appelApi } from '@/lib/api';
import { exigerSession } from '@/lib/session';
import type { AttributDefinition, AttributTemplate, CategorieArbre } from '@/lib/types';

export default async function PageAttributs() {
  await exigerSession();

  const [attributs, templates, arbre] = await Promise.all([
    appelApi<AttributDefinition[]>('/attributs'),
    appelApi<AttributTemplate[]>('/attributs/templates'),
    appelApi<CategorieArbre[]>('/categories/arbre'),
  ]);

  // Un modèle déjà cloné n'est plus proposé : l'API refuserait le doublon de nom.
  const dejaClones = new Set(attributs.map((a) => a.nom));
  const disponibles = templates.filter((t) => !dejaClones.has(t.nom));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Attributs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Taille, couleur, matière… Définis au niveau de l&apos;entreprise, puis rattachés aux
          catégories qui les utilisent. Un sac n&apos;a pas de taille, une robe si.
        </p>
      </div>

      <DepuisModele templates={disponibles} />
      <FormulaireCreation />

      {attributs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun attribut pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-4">
          {attributs.map((a) => (
            <CarteAttribut key={a.id} attribut={a} arbre={arbre} />
          ))}
        </div>
      )}
    </div>
  );
}
