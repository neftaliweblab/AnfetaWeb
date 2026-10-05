import type { GlobalPasteImagePayload } from '@/components/ResultsViewHost/GlobalPasteModal';

export function captureFilename(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Captura_ANFETA_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}
export function isTextEditing(element: Element | null) {
  return !!element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
}
export async function captureFromBlob(source: Blob): Promise<GlobalPasteImagePayload> {
  let blob = source;
  if (source.type !== 'image/png') {
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); throw new Error('No se pudo preparar la captura.'); }
    context.drawImage(bitmap, 0, 0); bitmap.close();
    blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(image => image ? resolve(image) : reject(new Error('No se pudo convertir la captura a PNG.')), 'image/png'));
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('No se pudo leer la captura.')); reader.readAsDataURL(blob);
  });
  return { dataUrl, base64: dataUrl.split(',')[1], filename: captureFilename(), sizeBytes: blob.size, contentType: 'image/png' };
}
