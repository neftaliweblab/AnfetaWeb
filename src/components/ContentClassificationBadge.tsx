import {contentClassification} from '@/lib/contentClassification';

export function ContentClassificationBadge({title, domain}:{title?:string; domain?:string}){
  const kind = contentClassification(title || '', domain);
  if (!kind) return null;
  return (
    <span
      aria-label={kind==='project'?'Proyecto':'Documentación'}
      title={kind === 'project' ? 'Proyecto · trabajo en curso (p.)' : 'Documentación · referencia y aprendizaje (d.)'}
      className={
        'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[8px] leading-none ' +
        (kind === 'project'
          ? 'border-cyan-900/60 text-cyan-400/80'
          : 'border-violet-900/60 text-violet-400/80')
      }
    >
      {kind === 'project' ? 'P' : 'D'}
    </span>
  );
}
