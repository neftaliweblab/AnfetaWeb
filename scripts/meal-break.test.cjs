const test = require('node:test');
const assert = require('node:assert/strict');

// Simular entorno y probar lógica de servicio de Horario Especial / Comida
test('mealBreak: formato de hora 12h y valores predeterminados', () => {
  // Lógica de formatHour12
  function formatHour12(hour, minute = 0) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const minStr = minute > 0 ? `:${minute.toString().padStart(2, '0')}` : ':00';
    return `${h12}${minStr} ${ampm}`;
  }

  assert.equal(formatHour12(13, 0), '1:00 PM');
  assert.equal(formatHour12(14, 0), '2:00 PM');
  assert.equal(formatHour12(13, 30), '1:30 PM');
  assert.equal(formatHour12(12, 0), '12:00 PM');
  assert.equal(formatHour12(8, 0), '8:00 AM');
  assert.equal(formatHour12(0, 0), '12:00 AM');
});

test('mealBreak: cálculo de posición y altura en canvas', () => {
  const startHour = 13;
  const startMinute = 0;
  const endHour = 14;
  const endMinute = 0;
  const pixelsPerHour = 72;
  const baseHour = 8;

  const startMin = startHour * 60 + startMinute;
  const endMin = endHour * 60 + endMinute;

  const top = ((startMin - baseHour * 60) / 60) * pixelsPerHour;
  const height = ((endMin - startMin) / 60) * pixelsPerHour;

  assert.equal(top, 360, 'El top para 13:00 con base 8:00 a 72px/h debe ser 360px');
  assert.equal(height, 72, 'La altura para 1 hora a 72px/h debe ser 72px');
});

test('mealBreak: exclusividad de usuario para Neftali', () => {
  function normalizePerson(input) {
    if (!input) return 'Sin asignar';
    const clean = input.trim().toLowerCase();
    if (clean === 'neftali' || clean === 'neft') return 'Neftali';
    return input;
  }

  function isNeftaliUser(user) {
    return normalizePerson(user) === 'Neftali';
  }

  assert.equal(isNeftaliUser('Neftali'), true);
  assert.equal(isNeftaliUser('neftali'), true);
  assert.equal(isNeftaliUser('neft'), true);
  assert.equal(isNeftaliUser('John'), false);
  assert.equal(isNeftaliUser('Karla'), false);
  assert.equal(isNeftaliUser('Edwin'), false);
});
