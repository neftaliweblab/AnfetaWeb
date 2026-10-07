# ANFETA WEB — estado y pendientes
Actualizado: 2026-10-07. Implementado significa presente en el código; no implica validación completa en producción.

## IMPLEMENTADO EN EL CÓDIGO
- BUSCADOR: consultas avanzadas, filtros, índice paginado, incremental y guardado por lotes; seis bases del escritorio, clasificación, deduplicación por ID, recordatorios completados excluidos y orden por modificación descendente. Exportación CSV de todos los resultados filtrados.
- FAVORITOS: favoritos y búsquedas guardadas por cuenta; eventos entre pestañas, foco y consulta periódica entre dispositivos.
- EXPLORADOR: carpetas y acciones API/enlaces; archivos Windows limitados al servidor local configurado.
- DETALLES: contenido Notion, checklist, imágenes, copiar, lectura y ampliar. Fijar/desfijar detalle al navegar otras filas.
- CALENDARIO: columnas iguales; tamaños, orden y personas; guardar/recuperar vista en cuenta. Cobros/Pagos y recordatorios como columnas independientes. Refresco automático y eventos de cambios.
- REVISIONES: John/Isaías/Genaro, asignación real, copia visual identificada y protegida, aprobación, devolución, reasignación, hilos y avisos.
- CHECKLIST: exclusión por Código significativo al 80 %, ramas de contenedores, metadatos y páginas hijas; tachados incluidos; historial comprobado de cambios web.
- SESIONES/HISTORIAL: temporizador, registros y movimientos web.
- ROBOT: corrida con web abierta y endpoint para programador externo, lotes y exclusión de corridas duplicadas web.
- AVANCE DIARIO: KPIs, filtros por persona, HTML e impresión PDF; advertencias de historial sin fecha comprobada.
- MENSAJES: revisiones y conversaciones generales, hilos, respuestas, paginación, lectura, atención y archivo por cuenta.
- RECORDATORIOS: persistencia, asignación, prioridad, completar, conflictos y refresco. Posponer 15 minutos/1 hora/24 horas (SQL 12). Filtros Todos/Pendientes/Completados/Vencidos y etiqueta de vencimiento.
- SUBIDAS: modal único, tres destinos, DRX, Ctrl+V, múltiples archivos, páginas separadas, numeración, sobrescritura cloud y actividad tras respaldo.
- PLANTILLAS: catálogo y copia de bloques comunes/subtareas con errores visibles para tipos no compatibles.
- NOTIFICACIONES: avisos de revisión, lectura por cuenta, refresco y soporte de suscripción push PWA.
- CUENTAS/AJUSTES: acceso compartido y persona libre autorizados; permisos sobre identidad de sesión; preferencias y presencia.
- PWA: instalación y soporte de push.
- MEET: accesos rápidos disponibles.

## LO QUE FALTA POR MÓDULO
- BUSCADOR: importar CSV, vigilancia con web cerrada y administración segura de páginas huérfanas. Conciliar el número de páginas con escritorio usando mismas bases, permisos y momento de lectura.
- FAVORITOS: validar sincronización/conflictos entre dispositivos reales; recuperar datos antiguos por propietario cuando proceda.
- EXPLORADOR: puente Windows autorizado y renombrado inteligente por lote.
- DETALLES: editor completo de bloques, más formatos y panel flotante independiente. Panel fijado ya implementado.
- CALENDARIO: validar Cobros/Pagos con datos reales del escritorio, móvil y actividades secundarias; integración de reuniones sin Google Calendar. Validar recuperación cloud de vistas.
- REVISIONES: nomenclatura avanzada restante y pruebas cruzadas reales de envío, devolución, aprobación, copias, reasignación y notificaciones.
- CHECKLIST/SESIONES: importar y conciliar historial del escritorio. No inferir fecha de marcado a partir de la última edición de texto de Notion. Verificación integrada de reglas y métricas con páginas reales.
- ROBOT: configurar programador externo, verificar ejecución con web cerrada y coordinación de bloqueos con escritorio.
- AVANCE DIARIO: historial equivalente y MiaoVision (aplazado junto con IA).
- MENSAJES: adjuntos y audio; validar estados y privacidad entre cuentas reales.
- RECORDATORIOS: importación desde escritorio, recurrencia y alarmas push por vencimiento con PWA cerrada.
- SUBIDAS: archivos grandes/directos y recuperación persistente de lotes parcialmente subidos; validación real Notion/Dropbox.
- PLANTILLAS/PROYECTOS: medios, columnas y tipos complejos; preproyectos.
- NOTIFICACIONES: configurar y validar VAPID, permisos y entregas con PWA cerrada; verificar lectura entre dispositivos.
- CUENTAS/AJUSTES: validación real de cambios de persona, aislamiento, preferencias y presencia. Selección libre no verifica la identidad humana, conforme al modelo autorizado.
- PWA: offline, cola de cambios, resolución de conflictos y sincronización al reconectar.
- IA/VOZ: asistente contextual, comandos y ejecución por voz — AL FINAL por petición del usuario.
- GOOGLE CALENDAR: FUERA DEL ALCANCE por petición del usuario.

## PUBLICACIÓN Y VERIFICACIÓN
- Publicar el código local y comprobar los flujos con usuarios/dispositivos reales.
- Migraciones del proyecto: hasta SQL 12; no repetir la instalación completa sobre un proyecto existente. Aplicar solo actualizaciones que falten. Posponer requiere RECORDATORIOS_POSPONER.sql.
- Detalles fijados y filtros de recordatorios no requieren SQL nuevo.
- Quedan avisos de compilación existentes sobre acceso al disco Dropbox; no son errores de TypeScript.
- No se afirma paridad total ni que estos cambios estén desplegados.
