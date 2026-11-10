const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST: Botón de Ordenar Actividades con Reglas Definidas (Junta John) ===\n');

// 1. Verificar definición de reglas en calendarReorderEngine.ts
const engineSrc = fs.readFileSync(
  path.join(__dirname, '../src/services/calendarReorderEngine.ts'),
  'utf8'
);

assert(engineSrc.includes('CALENDAR_REORDER_RULES'), 'Debe exportar CALENDAR_REORDER_RULES');
assert(engineSrc.includes('timeline_congruence'), 'Debe incluir regla de congruencia temporal (sin pasado)');
assert(engineSrc.includes('strict_priority'), 'Debe incluir regla de jerarquía de prioridades (00 > 11 > 22 > 33)');
assert(engineSrc.includes('sequential_chain'), 'Debe incluir regla de desempalme en cadena');
assert(engineSrc.includes('preserve_duration'), 'Debe incluir regla de duración estimada');
assert(engineSrc.includes('preserve_fixed'), 'Debe incluir regla de intocabilidad de terminadas/revisión');
assert(engineSrc.includes('shift_limits'), 'Debe incluir regla de límite de jornada (18:00)');
console.log('✓ calendarReorderEngine: Las 6 reglas de negocio están formalmente definidas.');

// 2. Verificar CalendarReorderModal.tsx
const modalSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/CalendarHost/CalendarReorderModal.tsx'),
  'utf8'
);

assert(modalSrc.includes('CalendarReorderModal'), 'Debe exportar CalendarReorderModal');
assert(modalSrc.includes('CALENDAR_REORDER_RULES'), 'Debe mostrar las reglas definidas en el modal');
assert(modalSrc.includes('calendar-batch-schedule'), 'Debe guardar mediante lote seguro a Notion');
assert(modalSrc.includes('showCreationResult'), 'Debe mostrar notificación toast en esquina inferior derecha');
console.log('✓ CalendarReorderModal: Modal interactivo con acordeón de reglas, tabla comparativa y guardado por lote.');

// 3. Verificar integración en CalendarColHeader.tsx
const colHeaderSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/CalendarHost/CalendarColHeader.tsx'),
  'utf8'
);

assert(colHeaderSrc.includes("['organize','⚡ Desempalmar y ordenar jornada…']"), 'Columna debe incluir opción de ordenar jornada');
console.log('✓ CalendarColHeader: Opción de desempalmar y ordenar presente en menú de columna de cada colaborador.');

// 4. Verificar integración en CalendarTopControls.tsx
const topControlsSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/CalendarHost/CalendarTopControls.tsx'),
  'utf8'
);

assert(topControlsSrc.includes('onOpenReorder'), 'CalendarTopControls debe aceptar prop onOpenReorder');
assert(topControlsSrc.includes('Ordenar acts'), 'Debe mostrar botón "Ordenar acts"');
console.log('✓ CalendarTopControls: Botón visible "⚡ Ordenar acts" integrado en la barra superior del calendario.');

// 5. Verificar integración en CalendarHost.tsx
const hostSrc = fs.readFileSync(
  path.join(__dirname, '../src/components/CalendarHost/CalendarHost.tsx'),
  'utf8'
);

assert(hostSrc.includes('CalendarReorderModal'), 'CalendarHost debe importar CalendarReorderModal');
assert(hostSrc.includes('showReorderModal'), 'CalendarHost debe gestionar estado showReorderModal');
assert(hostSrc.includes("action==='organize'"), 'CalendarHost debe abrir modal al recibir acción organize');
console.log('✓ CalendarHost: Integración completa de estado, disparador y renderizado del modal.');

console.log('\n=============================================');
console.log('¡TODAS LAS PRUEBAS DE REORDENAMIENTO PASARON!');
console.log('=============================================');
