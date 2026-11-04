/** MIME parameters may contain commas (video/webm;codecs=vp8,opus). */
export function dataUrlBase64(value: string): string {
  const marker = ';base64,';
  const index = value.indexOf(marker);
  if (index < 0) throw new Error('No se pudo leer el contenido del archivo.');
  const content = value.slice(index + marker.length);
  if (!content) throw new Error('El archivo no tiene contenido.');
  return content;
}
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(dataUrlBase64(String(reader.result || ''))); }
      catch (error) { reject(error); }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo. Tu grabación se conserva.'));
    reader.onabort = () => reject(new Error('Lectura cancelada. Tu grabación se conserva.'));
    reader.readAsDataURL(blob);
  });
}
