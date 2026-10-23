import {useId,type ButtonHTMLAttributes,type CSSProperties} from 'react';
const colors={cyan:'6,182,212',amber:'245,158,11',sky:'14,165,233',rose:'244,63,94'};
export function FloatingActionButton({label,tone,className='',children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string;tone:keyof typeof colors}){
 const tooltip=useId();
 return <button {...props} type="button" aria-label={label} aria-describedby={tooltip} className={`anfeta-floating-action group fixed z-[401] flex h-11 w-11 items-center justify-center rounded-full border text-white disabled:opacity-50 ${className}`} style={{'--action-rgb':colors[tone]} as CSSProperties}>
  <span aria-hidden="true">{children}</span>
  <span id={tooltip} role="tooltip" className="pointer-events-none absolute right-full mr-3 w-max max-w-64 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>
 </button>;
}
