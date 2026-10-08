const colors: Record<string, string> = {
  COBRADO: 'border-emerald-700/60 bg-emerald-950/80 text-emerald-200',
  PAGADO: 'border-emerald-700/60 bg-emerald-950/80 text-emerald-200',
  TERMINADO: 'border-emerald-700/60 bg-emerald-950/80 text-emerald-200',
  PENDIENTE: 'border-amber-700/60 bg-amber-950/80 text-amber-200',
  REVISAR: 'border-fuchsia-700/60 bg-fuchsia-950/80 text-fuchsia-200',
  PAUSADO: 'border-violet-700/60 bg-violet-950/80 text-violet-200',
};

export function FinanceStatusBadge({status}: {status?: string}) {
  const label = status?.trim() || 'Sin estado';
  return <span title={'Estado: '+label} className={'inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none '+(colors[label.toUpperCase()] || 'border-slate-600 bg-slate-800 text-slate-200')}><span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-current"/><span className="truncate">{label}</span></span>;
}
