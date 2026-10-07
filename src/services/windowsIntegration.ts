export interface WindowsAudioDevice {
  id: string;
  label: string;
  kind: "audioinput" | "audiooutput";
}

export async function getWindowsAudioDevices(): Promise<WindowsAudioDevice[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(
        (d): d is MediaDeviceInfo & { kind: "audioinput" | "audiooutput" } =>
          d.kind === "audioinput" || d.kind === "audiooutput"
      )
      .map((d, idx) => ({
        id: d.deviceId || `device_${idx}`,
        label:
          d.label ||
          `${d.kind === "audioinput" ? "Micrófono" : "Altavoz"} Windows ${idx + 1}`,
        kind: d.kind,
      }));
  } catch {
    return [];
  }
}

export function playTestChime(volume: number = 0.8) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(volume * 0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

/** Chime suave al marcar un check o checklist */
export function playCheckChime(volume: number = 0.5) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
    gain.gain.setValueAtTime(volume * 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

/** Sonido al copiar texto al portapapeles */
export function playCopyChime(volume: number = 0.5) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.06); // D6
    gain.gain.setValueAtTime(volume * 0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

/** Sonido al eliminar una página o elemento */
export function playDeleteChime(volume: number = 0.5) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc.frequency.setValueAtTime(329.63, ctx.currentTime + 0.08); // E4
    gain.gain.setValueAtTime(volume * 0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

/** Enviar notificación nativa de Windows (Toast Notification) */
export async function sendWindowsNotification(title: string, body: string, icon = "/icon-192.png") {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission === "granted") {
      new Notification(title, {
        body,
        icon,
        badge: icon,
        silent: false,
      });
    }
  } catch (e) {
    console.error("Error enviando notificación nativa de Windows:", e);
  }
}

export function openNotionPage(url: string) {
  if (!url || typeof window === "undefined") return;
  try {
    const target = new URL(url);
    if (!['https:', 'http:'].includes(target.protocol)) return;
    const link = document.createElement('a');
    link.href = target.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  } catch { /* Los enlaces inválidos no abren protocolos del sistema. */ }
}

export function openWindowsSoundSettings() {
  window.open("ms-settings:sound", "_self");
}
