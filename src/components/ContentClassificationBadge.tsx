import {contentClassification} from '@/lib/contentClassification';

export function ContentClassificationBadge({title, domain}:{title?:string; domain?:string}){
  const kind = contentClassification(title || '', domain);
  if (!kind) return null;
  return (
    <span
      title={kind === 'project' ? 'Proyecto · trabajo en curso (p.)' : 'Documentación · referencia y aprendizaje (d.)'}
      className={
        'shrink-0 rounded border px-1 py-0.5 text-[9px] font-semibold ' +
        (kind === 'project'
          ? 'border-cyan-700 bg-cyan-950/60 text-cyan-200'
          : 'border-violet-700 bg-violet-950/60 text-violet-200')
      }
    >
      {kind === 'project' ? 'P · Proyecto' : 'D · Documentación'}
    </span>
  );
}
