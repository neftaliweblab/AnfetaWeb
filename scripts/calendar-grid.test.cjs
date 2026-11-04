const fs=require('fs'),path=require('path'),assert=require('assert/strict'),ts=require('typescript');
const Module=require('module'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,parent,...rest){if(name.startsWith('@/'))name=path.join(__dirname,'../src',name.slice(2));return resolve.call(this,name,parent,...rest);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,file);
const mod={exports:require('../src/components/CalendarHost/CalendarHourGrid.tsx')};
for(const zoom of [48,72,144,288,576]){const layers=mod.exports.calendarHourGridBackground(zoom);assert.ok(layers.includes(`transparent ${zoom}px`));assert.ok(layers.includes(`var(--anfeta-grid-step, ${zoom/2}px)`));for(const interval of [5,10,15,20,30,60])assert.ok(mod.exports.calendarHourGridBackground(zoom,interval).includes(`var(--anfeta-grid-step, ${zoom*interval/60}px)`));assert.ok(layers.includes(`transparent ${zoom*2}px`));const grid=mod.exports.CalendarHourGrid({pixelsPerHour:zoom});assert.equal(grid.props['aria-hidden'],true);assert.ok(grid.props.className.includes('pointer-events-none'));}
assert.deepEqual(mod.exports.gridDivisions(15),[15,30,45]);assert.deepEqual(mod.exports.gridDivisions(20),[20,40]);assert.deepEqual(mod.exports.gridDivisions(30),[30]);
console.log('OK franjas: alineación a distintos niveles de zoom, horas/medias/cuarto y fondo decorativo sin bloquear el arrastre.');

const opts=require('../src/lib/calendarDisplayOptions.ts');
assert.deepEqual(mod.exports.gridDivisions(5),[5,10,15,20,25,30,35,40,45,50,55]);
assert.deepEqual(mod.exports.gridDivisions(10),[10,20,30,40,50]);
assert.deepEqual(mod.exports.gridDivisions(60),[]);
assert.deepEqual(opts.calendarLabelDivisions(5,72),[15,30,45]);
assert.deepEqual(opts.calendarLabelDivisions(5,288),mod.exports.gridDivisions(5));
assert.equal(opts.calendarDisplayHeight(99999),576);
assert.equal(opts.calendarDisplayHeight(-1),48);
const {calendarLayoutPreference}=require('../src/lib/calendarLayoutPreferences.ts');
const restored=calendarLayoutPreference({height:288,width:640,gridInterval:5},['Neftali','Edwin']);
assert.equal(restored.height,288);assert.equal(restored.width,640);assert.equal(restored.gridInterval,5);
assert.equal(calendarLayoutPreference({gridInterval:7},[]).gridInterval,30);
console.log('OK 5–60 minute lines, independent scale, readable labels and persisted large monitor layouts.');
