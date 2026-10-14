# Subidas y almacenamiento del índice

Aplicar SQL17 después de SQL15, antes de desplegar el código. SQL16 solo modifica el límite del mantenimiento manual; no es requisito para SQL17. No repetir la instalación completa.

## Cambios
- Los archivos seleccionados o arrastrados se conservan como Blob en IndexedDB; no se convierten todos a base64 al abrir el modal.
- Dropbox y el destino combinado envían fragmentos de 1 MB, uno por petición. Progreso y cursores se guardan después de cada confirmación. Las sesiones y recibos están firmados, vinculados a persona/lote/archivo. Las operaciones confirmadas tienen recibos duraderos; los resultados inciertos no se repiten a ciegas.
- El paso final envía metadatos y recibos de Dropbox, no el archivo nuevamente. Mantiene nombres, destinos DRX, páginas separadas y actividad del destino combinado.
- Solo Notion conserva su envío directo y límite de 2.5 MB por lote. El texto y adjuntos no se descartan para aparentar éxito.
- SQL17 guarda una sola carga inmutable por integración y hash. Las generaciones contienen referencias; lotes idénticos se reutilizan entre generaciones/personas de la misma integración. La publicación, versiones y lecturas mantienen los permisos anteriores. No son preferencias ni datos personales compartidos.
- Los registros antiguos siguen legibles. El próximo refresco de una generación antigua la convierte mediante una nueva publicación atómica. La limpieza limitada elimina referencias antiguas y cargas sin ninguna referencia; no borra una carga usada por otra generación.
- La sincronización Dropbox sigue todas las continuaciones y detecta un cursor repetido. Si falla, conserva el índice anterior. Continúa siendo un escaneo manual completo, no un explorador paginado por solicitudes del navegador.

## Validación
Pruebas locales con 6,500 filas: lectura íntegra, compatibilidad con lotes antiguos, nueva tabla con 65 cargas para dos generaciones idénticas, limpieza de cargas huérfanas y conservación de referencias activas. Subidas Dropbox simuladas: inicio/continuación/cierre, firma, persona, límite de fragmento y recibos sin repetir operaciones.

No se ha probado con credenciales reales ni se ejecutó la migración en producción. Los MB asignados del disco no se reducen inmediatamente; el mantenimiento de las generaciones existentes sigue siendo necesario. Cada plan gratuito conserva sus límites. La exploración por demanda y las subidas grandes directamente a Notion siguen siendo trabajo pendiente.
