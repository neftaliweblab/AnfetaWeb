# Envío a revisión sin bloquear la pantalla

- El selector se cierra al confirmar y un aviso independiente mantiene visible el guardado. La tarjeta cambia solo con la respuesta confirmada de Notion.
- Se impide repetir el envío de la misma página mientras está en curso. Los errores quedan visibles hasta cerrar el aviso; los cambios inciertos no se presentan como éxito.
- La API confirma primero la página y los metadatos de revisión. La creación/actualización del hilo de aviso se ejecuta con `after` de Next después de responder; no depende de que el navegador siga abierto una vez respondida la API.
- El aviso diferido toma el bloqueo por página y verifica que la versión del flujo siga vigente antes de añadir metadatos. Los fallos del aviso se registran en el servidor y no revierten una actividad ya guardada. El aviso diferido es trabajo posterior a la respuesta, no una cola durable con reintentos garantizados.
- El bloqueo global de horarios solo se toma para operaciones que validan empalmes. Revisiones y cambios de estado conservan el bloqueo individual sin bloquear otras actividades.
- No se aumentaron los sondeos ni se eliminaron verificaciones de permisos, concurrencia o empalmes.

Validación: pruebas con Notion simulado para respuesta previa al aviso y protección frente a una revisión posterior; prueba del cierre inmediato, envío duplicado y errores persistentes. No se midió latencia real en dos dispositivos.
