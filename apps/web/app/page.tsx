import { connection } from 'next/server';

// URL interne au réseau docker : le fetch est fait côté serveur, il vise le
// service `api` et non le port publié sur l'hôte.
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

type HealthResponse = { status: string };

type HealthResult = { reachable: true; status: string } | { reachable: false; erreur: string };

async function getHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (!res.ok) {
      return { reachable: false, erreur: `l'API a répondu ${res.status}` };
    }
    const data = (await res.json()) as HealthResponse;
    return { reachable: true, status: data.status };
  } catch (err) {
    return {
      reachable: false,
      erreur: err instanceof Error ? err.message : 'API injoignable',
    };
  }
}

export default async function Home() {
  // Sans ça, `next build` tenterait de préredre la page et figerait l'état de
  // l'API au moment du build. On veut l'état réel à chaque chargement.
  await connection();
  const health = await getHealth();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Fripstock</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Gestion de stock pour boutiques de seconde main.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Connexion à l&apos;API
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden
            className={`size-2.5 shrink-0 rounded-full ${
              health.reachable ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <p className="font-mono text-sm">
            {health.reachable
              ? `GET /health → { status: "${health.status}" }`
              : `GET /health → ${health.erreur}`}
          </p>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          {health.reachable
            ? `L'API répond sur ${API_URL}.`
            : `L'API est attendue sur ${API_URL}. Vérifie que la stack tourne avec « make up », puis « make logs ».`}
        </p>
      </section>
    </main>
  );
}
