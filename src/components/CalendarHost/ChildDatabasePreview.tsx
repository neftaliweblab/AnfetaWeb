import React from 'react';

export interface ChildDatabaseRow {
  id: string;
  url?: string;
  title: string;
  isChecked?: boolean;
  amount?: string;
  status?: string;
  tags?: string[];
  date?: string;
}

export interface ChildDatabaseBlock {
  id: string;
  kind: 'child_database';
  text: string;
  databaseId?: string;
  rows?: ChildDatabaseRow[];
  rowCount?: number;
  notionUrl?: string;
}

export function ChildDatabasePreview({ block }: { block: ChildDatabaseBlock }) {
  const isFinance = /cobr|pag|ingres|gasto|peso|\$/i.test(block.text || '');
  const rows = block.rows || [];

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 my-2 space-y-2.5 shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base select-none shrink-0">{isFinance ? '💰' : '🗃️'}</span>
          <span className="font-semibold text-slate-100 text-xs truncate">{block.text || 'Base de datos enlazada'}</span>
          {block.rowCount !== undefined && block.rowCount > 0 && (
            <span className="rounded bg-cyan-950/80 border border-cyan-600/50 px-1.5 py-0.5 text-[10px] text-cyan-300 font-mono shrink-0">
              {block.rowCount} {block.rowCount === 1 ? 'registro' : 'registros'}
            </span>
          )}
        </div>
        <a
          href={block.notionUrl || `https://notion.so/${block.id?.replace(/-/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-cyan-300 hover:text-white hover:border-cyan-400 transition flex items-center gap-1 shrink-0"
        >
          <span>Abrir en Notion</span>
          <span>↗</span>
        </a>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded border border-slate-800 scrollbar-thin scrollbar-thumb-slate-700">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="py-1.5 px-2 w-8 text-center">✓</th>
                <th className="py-1.5 px-2">Concepto / Título</th>
                <th className="py-1.5 px-2 text-right">Monto</th>
                <th className="py-1.5 px-2">Estado / Tags</th>
                <th className="py-1.5 px-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-1.5 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!row.isChecked}
                      readOnly
                      className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500 accent-emerald-500 cursor-default"
                    />
                  </td>
                  <td className="py-1.5 px-2 font-medium text-slate-100 max-w-xs truncate">
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-300 hover:underline">
                        {row.title}
                      </a>
                    ) : (
                      row.title
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap">
                    {row.amount ? (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          String(row.amount).startsWith('-')
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                        }`}
                      >
                        {row.amount} {String(row.amount).includes('$') || String(row.amount).includes('MXN') ? '' : 'MXN'}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {row.status && (
                        <span className="rounded bg-amber-950/60 border border-amber-800/50 px-1.5 py-0.2 text-[10px] text-amber-200">
                          {row.status}
                        </span>
                      )}
                      {(row.tags || []).slice(0, 2).map((tag, tIdx) => (
                        <span key={tIdx} className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[10px] text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-slate-400 text-[10px] whitespace-nowrap font-mono">
                    {row.date || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[11px] text-slate-400 py-1.5 px-2 bg-slate-950/40 rounded border border-slate-800/60 flex items-center justify-between">
          <span>Base de datos enlazada en Notion. Haz clic en el botón superior para ver o editar sus registros completos.</span>
        </div>
      )}
    </div>
  );
}
