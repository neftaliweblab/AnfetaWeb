export type GlobalAppView = 'results' | 'calendar' | 'dailyProgress' | 'messages' | 'reminders';
export type ShortcutTargetView = GlobalAppView;

export const MODULE_CYCLE_ORDER: readonly ShortcutTargetView[] = [
  'results',
  'calendar',
  'dailyProgress',
  'messages',
  'reminders',
];

export type GlobalShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'isComposing'
> & {
  code?: string;
  getModifierState?: (keyArg: string) => boolean;
};

export function toggleSearchCalendarView(currentView: string): ShortcutTargetView {
  return currentView === 'calendar' ? 'results' : 'calendar';
}

export function nextModuleView(currentView: string): ShortcutTargetView {
  const index = MODULE_CYCLE_ORDER.indexOf(currentView as ShortcutTargetView);
  if (index === -1) return MODULE_CYCLE_ORDER[0];
  return MODULE_CYCLE_ORDER[(index + 1) % MODULE_CYCLE_ORDER.length];
}

export function resolveExtensionModuleAction(
  mode: unknown,
  currentView: string
): { targetView: ShortcutTargetView; focusSearch: boolean } | null {
  if (mode === 'toggle-search-calendar') {
    const targetView = toggleSearchCalendarView(currentView);
    return { targetView, focusSearch: targetView === 'results' };
  }
  if (mode === 'cycle') {
    const targetView = nextModuleView(currentView);
    return { targetView, focusSearch: targetView === 'results' };
  }
  if (
    typeof mode === 'string' &&
    MODULE_CYCLE_ORDER.includes(mode as ShortcutTargetView)
  ) {
    return { targetView: mode as ShortcutTargetView, focusSearch: mode === 'results' };
  }
  return null;
}

/**
 * Resolves built-in browser shortcuts (without any browser extension) to switch
 * or toggle between Buscador ('results'), Calendario ('calendar'), Avance Diario ('dailyProgress'),
 * Mensajes ('messages'), and Recordatorios ('reminders').
 */
export function resolveGlobalViewShortcut(
  event: GlobalShortcutEvent,
  currentView: string
): { targetView: ShortcutTargetView; focusSearch: boolean } | null {
  if (event.repeat || event.isComposing || event.getModifierState?.('AltGraph')) {
    return null;
  }

  const key = String(event.key || '').toLowerCase();
  const code = String(event.code || '');
  const hasCtrl = Boolean(event.ctrlKey);
  const hasAlt = Boolean(event.altKey);
  const hasShift = Boolean(event.shiftKey);
  const hasMeta = Boolean(event.metaKey);

  if (hasMeta) return null;

  const isKey = (char: string, expectedCode: string) =>
    key === char || code === expectedCode;

  // Direct module shortcuts (Alt + 1..5): reliable across Chrome/Edge on Windows without AltGr conflicts
  if (!hasCtrl && hasAlt && !hasShift) {
    if (isKey('1', 'Digit1') || code === 'Numpad1') {
      return { targetView: 'results', focusSearch: true };
    }
    if (isKey('2', 'Digit2') || code === 'Numpad2') {
      return { targetView: 'calendar', focusSearch: false };
    }
    if (isKey('3', 'Digit3') || code === 'Numpad3') {
      return { targetView: 'dailyProgress', focusSearch: false };
    }
    if (isKey('4', 'Digit4') || code === 'Numpad4') {
      return { targetView: 'messages', focusSearch: false };
    }
    if (isKey('5', 'Digit5') || code === 'Numpad5') {
      return { targetView: 'reminders', focusSearch: false };
    }
    // Alt + Q: one-handed Buscador <-> Calendario toggle (zero Edge/Chrome/AltGr conflicts)
    if (isKey('q', 'KeyQ')) {
      const nextView = toggleSearchCalendarView(currentView);
      return { targetView: nextView, focusSearch: nextView === 'results' };
    }
  }

  // Toggle Buscador <-> Calendario: Ctrl+Alt+C or Alt+Shift+C or Ctrl+Shift+K
  if (
    isKey('c', 'KeyC') &&
    ((hasCtrl && hasAlt && !hasShift) || (!hasCtrl && hasAlt && hasShift))
  ) {
    const nextView = toggleSearchCalendarView(currentView);
    return { targetView: nextView, focusSearch: nextView === 'results' };
  }

  if (isKey('k', 'KeyK') && hasCtrl && hasShift && !hasAlt) {
    const nextView = toggleSearchCalendarView(currentView);
    return { targetView: nextView, focusSearch: nextView === 'results' };
  }

  // Focus Buscador directly: Ctrl+Alt+B
  if (isKey('b', 'KeyB') && hasCtrl && hasAlt && !hasShift) {
    return { targetView: 'results', focusSearch: true };
  }

  // Avance Diario: Ctrl+Shift+J
  if (isKey('j', 'KeyJ') && hasCtrl && hasShift && !hasAlt) {
    return { targetView: 'dailyProgress', focusSearch: false };
  }

  return null;
}
