# Grabaciones y respuestas temporales: excepción de empalmes

El guardado directo de una grabación creaba una página a las 09:00–10:00 y exigía el mismo hueco libre que una actividad normal. Las páginas de aviso `[RESPUESTA]` también figuraban como tiempo ocupado. Esta combinación podía impedir subir el video aunque la grabación fuese solo una referencia.

- Política compartida entre servidor, validación del calendario, sugerencias y planificadores: `[RESPUESTA]`, `[GRABACIÓN]` y el título histórico generado «Grabación YYYY-MM-DD» permiten compartir horario y no bloquean actividades reales.
- El grabador directo indica `calendarEntryKind: recording`; si incluye un adjunto de video, el servidor conserva la marca `[GRABACIÓN]` en el título para futuras lecturas/ediciones. Un flag sin video no transforma una actividad normal en grabación.
- Las frases comunes «Respuesta al cliente» y «Preparar grabación de tutorial» siguen siendo tareas normales. No hay un booleano genérico de omitir empalmes.
- Las grabaciones y respuestas se conservan visibles y no se borran. El planificador no las mueve como trabajo ordinario y no las usa como tiempo ocupado. Ampliar una grabación no arrastra otras actividades en cadena.
- Se mantienen los permisos, validación de fecha/hora, control de concurrencia de páginas y validaciones/subida del archivo. La excepción elimina la necesidad de un hueco libre, no las demás comprobaciones.
- Tras una creación confirmada desde el grabador directo, la nueva página se publica incrementalmente en calendario/buscador sin pedir una recarga general.

Validación: grabación con video guardada sin consultar huecos; flag sin adjunto rechazado ante conflicto; horario inválido sigue rechazado. Regresiones de conflicto normal, vecinos/sugerencias, cascada y robot con respuestas temporales. Todo con Notion simulado, sin subir archivos ni modificar páginas reales durante las pruebas.
