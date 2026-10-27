"use client";
import {takeReviewFailure} from './reviewOutcome';
import {recordAppLog} from './appDiagnostics';

const pending = new Set<string>();

/** Lives outside the dialog so closing it does not hide the save or its failure. */
export function submitReviewInBackground(pageId:string, reviewer:string, save:()=>Promise<boolean|void>|void, close:()=>void,owner='') {
  if(pending.has(pageId))throw Error('Esta actividad ya se está enviando a revisión.');
  pending.add(pageId);takeReviewFailure(pageId);
  const notice=document.createElement('div');
  notice.setAttribute('role','status');
  notice.style.cssText='max-width:380px;padding:16px;border:1px solid #22d3ee;border-radius:12px;background:#0c1824;color:#e2e8f0;box-shadow:0 8px 30px #0008;font:14px system-ui;pointer-events:auto';
  const message=document.createElement('span');
  message.textContent=`Enviando a revisión de ${reviewer}… Puedes seguir trabajando.`;
  let host=document.getElementById('anfeta-review-saves');
  if(!host){host=document.createElement('div');host.id='anfeta-review-saves';host.style.cssText='position:fixed;right:20px;bottom:24px;z-index:1000;display:flex;flex-direction:column;gap:8px;max-height:80vh;overflow:auto;max-width:calc(100vw - 40px);pointer-events:none';document.body.append(host);}
  notice.append(message);host.append(notice);
  close();
  return (async()=>{
  try {
    if(await save()===false)throw Error(takeReviewFailure(pageId)||'No se confirmó el envío. Revisa el aviso de la actividad y actualízala antes de volver a intentar.');
    message.textContent=`Actividad enviada a revisión de ${reviewer}.`;
    notice.style.borderColor='#34d399';
    setTimeout(()=>notice.remove(),5000);
  }catch(error){
    notice.setAttribute('role','alert');notice.style.borderColor='#fb7185';
    message.textContent=error instanceof Error?error.message:'No se confirmó el envío. Actualiza la actividad antes de repetirlo.';
    recordAppLog(owner,'Envío a revisión',`Actividad ${pageId} · Revisor ${reviewer}: ${message.textContent}`,'error');
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Cerrar aviso';dismiss.style.cssText='display:block;margin-top:10px;text-decoration:underline;cursor:pointer';dismiss.onclick=()=>notice.remove();notice.append(dismiss);
  }finally{pending.delete(pageId);}
  })();
}
