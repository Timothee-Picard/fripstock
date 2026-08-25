export function Champ({
  label,
  aide,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; aide?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
      />
      {aide ? <span className="mt-1 block text-xs text-slate-600">{aide}</span> : null}
    </label>
  );
}

export function Bouton({
  variante = 'principal',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'principal' | 'secondaire' | 'danger';
}) {
  const styles = {
    principal: 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400',
    secondaire: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    danger: 'text-red-700 hover:bg-red-50 border border-red-200',
  }[variante];
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

export function Alerte({
  children,
  ton = 'erreur',
}: {
  children: React.ReactNode;
  ton?: 'erreur' | 'info';
}) {
  const styles =
    ton === 'erreur'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <p className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</p>;
}
