export type GlobalAppView = 'results' | 'calendar' | 'dailyProgress' | 'messages' | 'reminders';
export type ShortcutTargetView = 'results' | 'calendar' | 'dailyProgress';

export type GlobalShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'isComposing'
> & {
  getModifierState?: (keyArg: string) => boolean;
};

/**
 * Resolves built-in browser shortcuts (without any browser extension) to switch
 * or toggle between Buscador ('results'), Calendario ('calendar'), and Avance Diario ('dailyProgress').
 */
export function resolveGlobalViewShortcut(
  event: GlobalShortcutEvent,
  currentView: string
): { targetView: ShortcutTargetView; focusSearch: boolean } | null {
  if (event.repeat || event.isComposing || event.getModifierState?.('AltGraph')) {
    return null;
  }

  const key = String(event.key || '').toLowerCase();
  const hasCtrl = Boolean(event.ctrlKey);
  const hasAlt = Boolean(event.altKey);
  const hasShift = Boolean(event.shiftKey);
  const hasMeta = Boolean(event.metaKey);

  if (hasMeta) return null;

  // Toggle Buscador <-> Calendario: Ctrl+Alt+C or Alt+Shift+C or Ctrl+Shift+K
  if (
    key === 'c' &&
    ((hasCtrl && hasAlt && !hasShift) || (!hasCtrl && hasAlt && hasShift))
  ) {
    const nextView: ShortcutTargetView = currentView === 'calendar' ? 'results' : 'calendar';
    return { targetView: nextView, focusSearch: nextView === 'results' };
  }

  if (key === 'k' && hasCtrl && hasShift && !hasAlt) {
    const nextView: ShortcutTargetView = currentView === 'calendar' ? 'results' : 'calendar';
    return { targetView: nextView, focusSearch: nextView === 'results' };
  }

  // Focus Buscador directly: Ctrl+Alt+B
  if (key === 'b' && hasCtrl && hasAlt && !hasShift) {
    return { targetView: 'results', focusSearch: true };
  }

  // Avance Diario: Ctrl+Shift+J
  if (key === 'j' && hasCtrl && hasShift && !hasAlt) {
    return { targetView: 'dailyProgress', focusSearch: false };
  }

  return null;
}
