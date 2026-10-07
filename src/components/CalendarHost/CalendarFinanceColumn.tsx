"use client";
import {mexicoDate,mexicoMinutes} from '@/services/calendarPresentation';
export function CalendarFinanceColumn({kind,items,warning,loading=false,width,height,pixelsPerHour,date,onMove,onClose}: {kind:'cobro'|'pago';items:any[];warning:string;loading?:boolean;width:number;height:number;pixelsPerHour:number;date:string;onMove:()=>void;onClose:()=>void}) {
  return <div className="min-w-0 border-r border-[#202832] flex flex-col" style={{height:height+56,flex:'1 0 '+width+'px',width}}>
    <div className="h-14 shrink-0 bg-[#101722] px-3 flex items-center gap-2 text-xs text-cyan-200">
      <strong>{kind==='cobro'?'💰 COBROS':'💳 PAGOS'} · {items.length}</strong>
      <button onClick={onMove} title="Mover las columnas financieras al otro extremo">↔</button><button onClick={onClose} title="Ocultar columna">×</button>
      {warning && <span title={warning} aria-label={warning}>ⓘ</span>}
    </div>
    <div className="relative flex-1 overflow-hidden bg-[#080B0F]" style={{height}}>
      {Array.from({length:Math.ceil(height/pixelsPerHour)+1},(_,i)=><div key={i} className="absolute w-full h-px bg-[#161F2B]" style={{top:i*pixelsPerHour}}/>)}
      {warning&&<p role="alert" className="relative z-10 m-2 rounded border border-amber-800 bg-slate-950 p-2 text-xs text-amber-200">{warning}</p>}{loading&&<p role="status" className="relative p-3 text-xs text-cyan-200">Cargando {kind==='cobro'?'cobros':'pagos'}…</p>}{!loading&&!warning&&!items.length && <p className="relative p-3 text-xs text-slate-500">Sin registros para esta fecha.</p>}
      {items.map((item,index)=>{const start=Math.max(480,mexicoDate(item.start)<date?480:mexicoMinutes(item.start));const end=mexicoDate(item.end)>date?1320:mexicoMinutes(item.end);return <a key={item.id} href={item.url || undefined} target="_blank" rel="noopener noreferrer" className="absolute rounded border border-cyan-800/50 bg-[#122128] px-2 py-1 text-xs text-slate-200 overflow-hidden" style={{top:(start-480)/60*pixelsPerHour,height:Math.max(28,(end-start)/60*pixelsPerHour),left:4+(index%2)*6,right:4}} title={item.title}><div className="font-medium truncate">{item.title}</div><div className="text-[10px] text-cyan-300/70 truncate">{item.person}</div></a>;})}
    </div>
  </div>;
}
