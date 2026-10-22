# Logs de ANFETA

El listado superior «Aviso de actualización» provenía de errores/avisos del calendario, incluidos los reportes del robot cuando no puede acomodar actividades entre 08:00 y 22:00. No implica necesariamente un fallo de conexión. El componente ahora registra estos avisos sin ocupar espacio en el calendario.

- Botón Logs con contador de registros nuevos en la barra principal y en el calendario independiente.
- Panel con hora de México, origen, aviso/error, posibles causas, sugerencias y mensaje original desplegable. Las causas son orientación por patrones del mensaje, no diagnósticos confirmados.
- Mensajes generales de acciones del calendario, errores globales del buscador, pendientes y sincronización del índice dirigidos al panel. Los errores de validación en formularios y de acceso a la sesión conservan su guía contextual.
- Errores inesperados de ejecución/promesas capturados para la persona activa, sin interceptar console ni todas las peticiones de red.
- Historial de hasta 80 registros en memoria/sessionStorage por persona y pestaña. Sobrevive a una recarga; no se comparte entre equipos ni se almacena en el servidor. Se agrupan mensajes idénticos del mismo origen y gravedad durante un minuto.
- Copiar reporte, limpiar historial local y reintentar explícitamente los pendientes. No hay envío automático de capturas o mensajes, ni recargas/repeticiones automáticas de acciones inciertas.
- Redacción de patrones comunes de credenciales antes de guardar/copiar. No se capturan cuerpos de peticiones, archivos ni conversaciones. Los títulos incluidos en el propio mensaje de error sí pueden aparecer en el reporte.

Para «No hay espacio suficiente», se recomienda revisar duración/día/huecos: recargar no crea espacio. Ante guardado incierto, primero comprobar la actividad antes de repetir. Un guardado con aviso secundario no se presenta como cambio principal fallido.

No requiere migraciones ni variables. Validación con TypeScript, build de producción y pruebas de historial, deduplicación, límites, aislamiento, recuperación, redacción de credenciales, recomendaciones y ausencia del banner, además de regresiones de calendario.
