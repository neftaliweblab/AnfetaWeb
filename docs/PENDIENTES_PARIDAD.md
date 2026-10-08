# ANFETA WEB — estado y pendientes
Actualizado: 2026-10-07. Implementado significa presente en el código; no implica validación completa en producción.

## IMPLEMENTADO EN EL CÓDIGO
- BUSCADOR: consultas avanzadas, filtros, índice paginado, incremental y guardado por lotes; seis bases del escritorio, clasificación, deduplicación por ID, recordatorios completados excluidos y orden por modificación descendente. Exportación CSV de todos los resultados filtrados. Importación CSV de consultas guardadas simples, con vista previa y deduplicación.
- FAVORITOS: favoritos y búsquedas guardadas por cuenta; filtro de consultas guardadas por nombre/texto; respaldo y recuperación de favoritos sin eliminar existentes; nombres editables y respaldo/recuperación JSON con vista previa, deduplicación y consultas conservadas; eventos entre pestañas, foco y consulta periódica entre dispositivos.
- EXPLORADOR: carpetas y acciones API/enlaces; archivos Windows integrados mediante bridge local HTTP (127.0.0.1:4821) y URI `anfeta://open` para ejecución directa en Windows Desktop. Renombrado inteligente masivo por lotes (prefijos, sufijos y reemplazo de texto con vista previa en vivo).
- DETALLES: contenido Notion, checklist, imágenes, audio/video directo, enlaces a PDF/archivos, filas de tablas y ecuaciones, copiar, lectura y ampliar. Fijar/desfijar detalle al navegar otras filas, agregar bloques de texto (`+ Bloque`), editor de bloques en línea y ventana independiente flotante (multi-monitor).
- CALENDARIO: edición de descripción preservando nomenclatura, fecha y horario, comprobación de conflictos y navegación al día reprogramado; barra compacta adaptable sin scroll horizontal; columnas iguales; tamaños, orden y personas; guardar/recuperar vista en cuenta. Cobros/Pagos y recordatorios como columnas independientes. Selector interactivo de plantillas rápidas integrado en "+ Nueva Actividad" (`CreateActivityModal`) y catálogo completo con plantillas secuenciales (`CalendarTemplatesModal`).
- REVISIONES: John/Isaías/Genaro, asignación real, tags activos/pasivos y sufijos según escritorio; copia visual inmediata con restauración ante fallo, protección frente a lecturas atrasadas, identificada y protegida, aprobación, devolución, reasignación, hilos y avisos.
- CHECKLIST: exclusión por Código significativo al 80 %, ramas de contenedores, metadatos y páginas hijas; tachados incluidos; historial comprobado de cambios web.
- SESIONES/HISTORIAL: temporizador, registros y movimientos web.
- ROBOT: corrida con web abierta y endpoint para programador externo, lotes y exclusión de corridas duplicadas web.
- AVANCE DIARIO: KPIs, filtros por persona, HTML e impresión PDF; advertencias de historial sin fecha comprobada.
- MENSAJES: revisiones y conversaciones generales individuales y de grupo, participantes visibles, mensajes multilínea, hilos, respuestas, paginación, lectura, atención y archivo por cuenta. Adjuntos (imágenes y documentos) y grabación de notas de voz web con reproductor integrado.
- RECORDATORIOS: persistencia, asignación, prioridad, completar, conflictos y refresco. Posponer 15 minutos/1 hora/24 horas (SQL 12). Agenda día/semana/mes, filtros por persona/texto y estado, etiqueta de vencimiento y exportación CSV de los visibles. Rango máximo 31 días y límite explícito de 500 registros por consulta. Importación desde Desktop JSON, alarmas locales programadas de PWA/Navegador y despachador de alarmas push en servidor para web/PWA cerrada (`/api/jobs/reminders`).
- SUBIDAS: modal único, tres destinos, DRX, Ctrl+V, múltiples archivos, páginas separadas, numeración, sobrescritura cloud, subida por sesión chunked oficial de Dropbox para archivos grandes y multi-gigabytes, actividad tras respaldo, y auto-guardado con recuperación de borradores ante desconexión (`anfeta_upload_draft`).
- PLANTILLAS: catálogo y copia de bloques comunes/subtareas, columnas y medios externos con errores visibles para archivos internos y tipos no compatibles. Generador masivo de preproyectos con 6 pasos oficiales y carpetas DRX de Desktop.
- NOTIFICACIONES: avisos de revisión, lectura por cuenta, refresco y soporte de suscripción push PWA.
- CUENTAS/AJUSTES: acceso compartido y persona libre autorizados; permisos sobre identidad de sesión; preferencias y presencia.
- PWA: instalación, soporte de push, pantalla pública de recuperación offline y aviso de desconexión; solicita refresco al reconectar. Cola persistente de mutaciones offline (`offlineQueue.ts`) que encola cambios y los sincroniza automáticamente en segundo plano al recuperar la conexión.
- MEET: accesos rápidos disponibles.

## LO QUE FALTA POR MÓDULO
- BUSCADOR: vigilancia con web cerrada y administración segura de páginas huérfanas. Conciliar el número de páginas con escritorio usando mismas bases, permisos y momento de lectura.
- FAVORITOS: validar sincronización/conflictos entre dispositivos reales; recuperar datos antiguos por propietario cuando proceda.
- EXPLORADOR: puente Windows autorizado para ejecución directa de ejecutables locales.
- DETALLES: editor completo de bloques y más formatos complejos.
- CALENDARIO: validar Cobros/Pagos con datos reales del escritorio, móvil y actividades secundarias; integración de reuniones sin Google Calendar. Validar recuperación cloud de vistas.
- REVISIONES: validar nomenclaturas especiales restantes con ejemplos reales; pruebas cruzadas reales de envío, devolución, aprobación, copias, reasignación y notificaciones.
- CHECKLIST/SESIONES: importar y conciliar historial del escritorio. No inferir fecha de marcado a partir de la última edición de texto de Notion. Verificación integrada de reglas y métricas con páginas reales.
- ROBOT: configurar programador externo, verificar ejecución con web cerrada y coordinación de bloqueos con escritorio.
- AVANCE DIARIO: historial equivalente y MiaoVision (aplazado junto con IA).
- RECORDATORIOS: recurrencia y alarmas push por vencimiento con PWA cerrada mediante servidor.
- SUBIDAS: recuperación persistente de lotes parcialmente subidos y validación real Notion/Dropbox.
- NOTIFICACIONES: configurar y validar VAPID, permisos y entregas con PWA cerrada; verificar lectura entre dispositivos.
- CUENTAS/AJUSTES: validación real de cambios de persona, aislamiento, preferencias y presencia. Selección libre no verifica la identidad humana, conforme al modelo autorizado.
- IA/VOZ: asistente contextual, comandos y ejecución por voz — AL FINAL por petición del usuario.
- GOOGLE CALENDAR: FUERA DEL ALCANCE por petición del usuario.

## PUBLICACIÓN Y VERIFICACIÓN
- Publicar el código local y comprobar los flujos con usuarios/dispositivos reales.
- Migraciones del proyecto: hasta SQL 12; no repetir la instalación completa sobre un proyecto existente. Aplicar solo actualizaciones que falten. Posponer requiere RECORDATORIOS_POSPONER.sql.
- Detalles fijados y filtros de recordatorios no requieren SQL nuevo.
- Quedan avisos de compilación existentes sobre acceso al disco Dropbox; no son errores de TypeScript.
- No se afirma paridad total ni que estos cambios estén desplegados.
