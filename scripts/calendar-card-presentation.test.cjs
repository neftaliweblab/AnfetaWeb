const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){return resolve.call(this,name.startsWith('@/')?path.join(root,'src',name.slice(2)):name,parent,...rest);};
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
global.fetch=()=>{throw Error('Presentation must not access Notion or update pages');};
const {calendarDomain,calendarDisplayTitle,calendarType}=require('../src/services/calendarPresentation.ts');
const cases=[
 ['prtuzR | 💻 sseo | 📅 11.s.09.00 SEO Optimización Técnica Posicionamiento SEO | 🌐 #p.mansynergy.com.mx.seo | 🛠️#descripcion | 🔁 #ffase00 | 👥 nne11 | ✅ gg-e000','mansynergy.com.mx','SEO Optimización Técnica Posicionamiento SEO'],
 ['tuzR | 💻 aapli | 📅 11.a.00.00 Asistente recurrente Mejoras y correcciones web ANFETA | 🌐 #d.anfeta.com.aplicacion.web | 🛠️ #descripcion | 👥 nne11 | ✅ gge000','anfeta.com','Asistente recurrente Mejoras y correcciones web ANFETA'],
 ['prtuzR | 💻 pprog | 📅 11.p.01.00 Instalar programa | 🌐 #p.anfeta.com.instalador | 🛠️#descripcion | 👥 eed11','anfeta.com','Instalar programa'],
 ['prtuzR | 💻 ccobr | 📅 11.c.00.00 Crear vista de pagos | 🌐 #d.weblab.mx | 🔁 #ffase00 | 👥 kka11','weblab.mx','Crear vista de pagos'],
 ['prtuzREVISION sseo 26-[10OCT] 15.00 Optimización técnica [seo.optica.com] nne11','optica.com','Optimización técnica'],
 ['prtuzR | 📅 11.[tipo].00.00 Base de conocimiento | 🌐 #d.dominio.com | 🛠️#descripcion | ✅','general','Base de conocimiento'],
 ['Cambiar DNS mirancho.mx','mirancho.mx','Cambiar DNS'],
];
for(const [raw,domain,title] of cases){
 const activity=Object.freeze({title:raw,domain:'general'}),before=JSON.stringify(activity);
 assert.equal(calendarDomain(activity.title,activity.domain),domain,raw);
 assert.equal(calendarDisplayTitle(activity.title,domain),title,raw);
 assert.equal(JSON.stringify(activity),before,'Raw activity must remain intact');
}
assert.equal(calendarDomain('Revisar https://docs.notion.com | 🌐 #p.anfeta.com','viejo.com'),'anfeta.com','Explicit title domain wins over cached metadata and incidental links');
assert.equal(calendarDomain('Sin dominio','real.app'),'real.app');
assert.equal(calendarDomain('Contacto usuario@gmail.com'),'general');
assert.equal(calendarDomain('Plantilla #p.dominio.com.instalador'),'general');
assert.equal(calendarDomain('Actividad sin dominio'),'general');
assert.equal(calendarType(cases[0][0]),'SEO');
console.log('OK 7 calendar card fixtures: real hashed domains, stale general metadata, legacy and modern titles, empty placeholders, clean numbering/emojis and no writes.');
