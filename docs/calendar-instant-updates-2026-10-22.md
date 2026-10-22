# Calendario inmediato y sincronización incremental — 22 octubre 2026

## Flujos revisados

- Crear, reasignar, enviar a revisión, aprobar/devolver, modificar fecha/duración, cambiar FTF, checklist, renombrar, cambios por lotes y recuperación offline.
- Calendario principal, calendario independiente y calendario individual del buscador usan el mismo conciliador de registros.
- Una actividad que llega al día visible se incorpora aunque no estuviera cargada. Una que cambia de día sale de la vista anterior. Se generan/retiran los espejos de revisión según el flujo confirmado, sin duplicarlos ni modificar copias históricas.
- Las respuestas antiguas no sobrescriben versiones nuevas. Una lectura inicial atrasada no elimina una actividad recién confirmada. Las respuestas de días anteriores de la ventana independiente se descartan.
- Los eventos de actividad incompletos conservan el checklist ya cargado y los campos que no incluyen.

## Inmediatez y carga

- Misma ventana/ventanas del mismo navegador: se aplican los cambios devueltos por Notion mediante el canal existente; no se espera un sondeo para presentarlos.
- Eventos remotos: una conexión compartida por cuenta y ventana. Con algún calendario visible, consulta solo eventos cada 2 segundos; con solo buscador, cada 10 segundos. Son intervalos de consulta, no garantías de latencia de Notion/red/webhooks.
- Los paneles no mantienen sondeos duplicados del mismo flujo. Los paneles ocultos no elevan la prioridad del calendario individual.
- Los guardados confirmados adelantan la siguiente lectura incremental. Lecturas de checklist y respuestas vacías no provocan una sincronización general.
- Se mantiene una comprobación directa acotada de hasta cuatro páginas cada minuto como respaldo. Esa comprobación no bloquea la lectura de eventos.
- Los eventos que llegan durante un guardado se conservan hasta que el panel pueda aplicarlos. Los cambios antiguos y duplicados se descartan.
- BroadcastChannel no escribe además en localStorage cuando entrega correctamente. El fallback se conserva y los mensajes tienen identidad para no aplicarse dos veces.

## Contenido y buscador

- Cambiar un check propaga el contador y el paso afectado. Crear checks/comentarios y editar bloques refresca únicamente el contenido de la página abierta que corresponda; no recarga el catálogo.
- Una edición abierta conserva el borrador; una actualización de contenido pendiente se aplica después de cerrar el editor.
- Las altas confirmadas de calendario se incorporan también al buscador de forma incremental.
- Las altas y cambios hechos en otros dispositivos incluyen los datos mínimos de la tarjeta (horario completo, responsable, estado y FTF) en el evento. Se valida la fuente de calendario cuando Notion devuelve data_source_id; no se inventan tarjetas desde páginas sin la fecha oficial.
- Renombrar en Notion ahora comprueba el PATCH real y usa la propiedad de título correcta. Un rechazo ya no devuelve éxito ficticio. El nombre confirmado se propaga al calendario.
- Las operaciones recuperadas offline propagan el registro o el contenido afectado. Cambios de recordatorios utilizan su propio evento y no fuerzan sincronización de Notion.

## Validación

- TypeScript y compilación de producción con Webpack.
- 79 regresiones de calendario anteriores y dos casos nuevos de renombrado confirmado/rechazado, todas con Notion simulado.
- scripts/calendar-instant-updates.test.cjs: altas fuera del conjunto cargado, cambios de día, revisión/espejos, conservación de checks, rechazo de estados antiguos, snapshots atrasados, una sola conexión, prioridades, eventos pendientes y mensajes duplicados.
- Pruebas de agenda, selector rápido, FTF, eventos Notion, índice paginado e incremental, editor/creación de bloques y recuperación offline/PWA.
- No se hicieron cambios de prueba en páginas reales de Notion ni se midió latencia entre dos dispositivos reales. Los cambios externos necesitan llegar por el webhook o por la comprobación acotada; no se garantiza que todo cambio hecho directamente en Notion se detecte en dos segundos.
- Sin nuevas variables de entorno ni migraciones. Se mantienen las configuraciones actuales de eventos y cron.
