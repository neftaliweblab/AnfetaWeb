const fs=require('fs'),assert=require('assert/strict'),ts=require('typescript');
const source=fs.readFileSync(require('path').join(__dirname,'../src/lib/confirmedCalendarActivity.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('exports','module',compiled)(mod.exports,mod);
const protect=mod.exports.confirmedCalendarActivity;
const saved={pageId:'a',title:'Trabajo',person:'Neftali',status:'Por hacer',start:'2026-10-14T14:00:00-06:00',end:'2026-10-14T15:00:00-06:00'};
const stale={...saved,start:'2026-10-14T10:00:00-06:00',end:'2026-10-14T11:00:00-06:00'};
assert.equal(protect(stale,saved),saved);
const fresh={...saved,checklistTotal:5};assert.equal(protect(fresh,saved),fresh);
assert.equal(protect(stale,saved),saved); // Respuesta atrasada después de una lectura correcta.
assert.equal(protect({...saved,end:stale.end},saved),saved);
assert.equal(protect({...saved,status:'Suspendida'},saved),saved);
const utc={...saved,start:'2026-10-14T20:00:00Z',end:'2026-10-14T21:00:00Z'};assert.equal(protect(utc,saved),utc);
console.log('OK: horario confirmado protegido ante lecturas atrasadas, fin y estado distintos; conserva enriquecimiento y zonas equivalentes.');
