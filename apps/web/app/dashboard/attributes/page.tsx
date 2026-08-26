import { AttributeCard, DepuisModele, CreateForm } from './forms';
import { apiFetch } from '@/lib/api';
import { requireSession } from '@/lib/session';
import type { AttributeDefinition, AttributeTemplate, CategoryTree } from '@/lib/types';

export default async function AttributesPage() {
  await requireSession();

  const [attributes, templates, tree] = await Promise.all([
    apiFetch<AttributeDefinition[]>('/attributes'),
    apiFetch<AttributeTemplate[]>('/attributes/templates'),
    apiFetch<CategoryTree[]>('/categories/tree'),
  ]);

  // Un modèle déjà cloné n'est plus proposé : l'API refuserait le doublon de nom.
  const dejaClones = new Set(attributes.map((a) => a.name));
  const disponibles = templates.filter((t) => !dejaClones.has(t.name));

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
      <CreateForm />

      {attributes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Aucun attribut pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-4">
          {attributes.map((a) => (
            <AttributeCard key={a.id} attribute={a} tree={tree} />
          ))}
        </div>
      )}
    </div>
  );
}
