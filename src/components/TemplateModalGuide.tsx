export function TemplateModalGuide({ configuring }: { configuring: boolean }) {
  return (
    <div className="shrink-0 border-b border-slate-700/70 bg-gradient-to-r from-cyan-950/70 to-slate-900 px-4 py-3">
      <ol aria-label="Pasos para usar una plantilla" className="flex flex-wrap gap-2 text-xs">
        <li aria-current={configuring ? undefined : "step"} className={configuring ? "text-slate-400" : "font-semibold text-cyan-200"}>1. Elegir plantilla</li>
        <li aria-hidden="true" className="text-slate-500">→</li>
        <li aria-current={configuring ? "step" : undefined} className={configuring ? "font-semibold text-cyan-200" : "text-slate-400"}>2. Configurar y revisar</li>
      </ol>
      <p className="mt-1 text-xs text-slate-300">
        {configuring ? "Completa los datos y revisa los títulos que se guardarán en Notion." : "Elige una categoría o busca por nombre. Selecciona las plantillas que quieras crear."}
      </p>
    </div>
  );
}
