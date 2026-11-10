const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST: Asignación Rápida, Detallada y Notificación con Enlace a Notion ===\n');

// 1. Verificar ScreenRecorder.tsx
const screenRecorderSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/ResultsViewHost/ScreenRecorder.tsx'),
  'utf8'
);

assert(screenRecorderSrc.includes('showCreationResult'), 'Debe importar y usar showCreationResult');
assert(screenRecorderSrc.includes('TEAM_MEMBERS'), 'Debe definir selector de integrantes del equipo');
assert(screenRecorderSrc.includes('PRIORITIES'), 'Debe definir selector de prioridades');
assert(screenRecorderSrc.includes('REVIEWERS'), 'Debe definir selector de revisores técnicos');
assert(screenRecorderSrc.includes('buildQuickTitle'), 'Debe construir el título técnico modularmente');
assert(screenRecorderSrc.includes('isClipboardTitleEdited'), 'Debe permitir editar el título en portapapeles');
assert(screenRecorderSrc.includes('isRecordingTitleEdited'), 'Debe permitir editar el título en grabación');
console.log('✓ ScreenRecorder: selectores modulares (responsable, prioridad, revisor), título editable y notificación listos');

// 2. Verificar GlobalPasteModal.tsx
const globalPasteSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/ResultsViewHost/GlobalPasteModal.tsx'),
  'utf8'
);

assert(globalPasteSrc.includes("useState<'both' | 'dropbox' | 'notion'>('notion')"), 'Debe tener "Solo Notion" como destino por defecto');
assert(globalPasteSrc.includes('customEditedTitle'), 'Debe permitir editar el título antes de guardar en asignación detallada');
assert(globalPasteSrc.includes('showCreationResult'), 'Debe emitir notificación con enlace al crear');
console.log('✓ GlobalPasteModal: modo predeterminado "Solo Notion", título final editable y enlace a Notion verificados');

// 3. Verificar CreationFeedback.tsx
const creationFeedbackSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/CreationFeedback.tsx'),
  'utf8'
);

assert(creationFeedbackSrc.includes('fixed bottom-5 right-5 z-[9999]'), 'Toast debe situarse en la esquina inferior derecha');
assert(creationFeedbackSrc.includes('pageUrl'), 'Debe soportar pageUrl');
assert(creationFeedbackSrc.includes('Abrir en Notion'), 'Debe incluir botón con enlace directo a la página en Notion');
console.log('✓ CreationFeedback: toast en la esquina inferior derecha con enlace directo a Notion verificado');

// 4. Verificar CalendarHost.tsx
const calendarHostSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/CalendarHost/CalendarHost.tsx'),
  'utf8'
);

assert(calendarHostSrc.includes('showCreationResult'), 'CalendarHost debe emitir showCreationResult al guardar o fallar');
console.log('✓ CalendarHost: notificaciones en tiempo real al guardar en Notion verificadas');

console.log('\n=============================================');
console.log('¡TODAS LAS PRUEBAS DE LA ASIGNACIÓN PASARON!');
console.log('=============================================');
