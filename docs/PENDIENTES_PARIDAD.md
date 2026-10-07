# Estado real de la web ANFETA

## Implementado en el código

- Buscador: índice persistente paginado, sincronización incremental, consultas y accesos rápidos de Meet.
- Favoritos: favoritos, búsquedas guardadas y preferencias por cuenta en Supabase.
- Calendario: columnas uniformes y configurables, tarjetas limpias, tipos, Cobros/Pagos independientes, columna de recordatorios y enlaces del escritorio por persona, incluido John secundario.
- Revisiones: John/Isaías/Genaro, asignación, copia visual, devolución, aprobación y avisos.
- Checklist: exclusiones de Código al 80 %, contenedores, metadatos, sincronizados y páginas hijas; tachados incluidos. Historial de cambios hechos desde la web con fecha comprobada y protección frente a lecturas antiguas.
- Robot: ejecución web y endpoint protegido para programador externo, lotes y bloqueo persistente por día entre instalaciones.
- Avance: indicadores, HTML y PDF desde impresión, advertencias para checks sin fecha comprobada.
- Mensajes: revisiones y conversaciones generales, nuevos hilos, respuestas, paginación, lectura, atención y archivo por cuenta; avisos PWA.
- Recordatorios: datos persistentes, asignación, prioridad, calendario y conflictos entre dispositivos.
- Subidas: modal único, tres destinos, DRX sin carpeta duplicada, persona, varios archivos, páginas separadas, numeración, sobrescritura Dropbox y actividad temporal tras respaldo.
- Plantillas: copia validada de bloques comunes y subtareas; errores visibles para formatos no compatibles.
- Cuentas: sesión e identidad verificadas, perfiles activos, preferencias y presencia.
- PWA: instalación y suscripción voluntaria a avisos push.

## Configuración que falta para utilizarlas en producción

- Aplicar las ocho migraciones, crear los perfiles y configurar Supabase según SUPABASE_SETUP.md.
- Configurar Notion, Dropbox y VAPID. Registrar el endpoint del robot en un programador con CRON_SECRET y un usuario activo autorizado.
- Publicar los cambios y probar con cuentas reales. Las pruebas locales no prueban permisos, contenidos o avisos del entorno publicado.

## Funciones pendientes

- Buscador: CSV, vigilancia autónoma con web cerrada y administración segura de páginas huérfanas.
- Explorador: puente Windows autorizado y renombrado inteligente por lote.
- Detalles: editor completo de bloques y paneles fijados/flotantes.
- Calendario: reuniones, comprobación visual móvil y conciliación de Cobros/Pagos con datos reales del escritorio.
- Revisiones: nomenclatura avanzada restante y pruebas cruzadas reales.
- Checklist y sesiones: importar/conciliar historial del escritorio. La última edición de Notion no permite deducir cuándo se marcó un check antiguo.
- Robot: configurar el programador externo; el endpoint por sí solo no ejecuta horarios.
- Avance: MiaoVision e historial equivalente al original.
- Mensajes: adjuntos y audio; actualización actual mediante sondeo, foco y acciones.
- Recordatorios: importación desde escritorio y alarmas push por vencimiento con web cerrada.
- Subidas: transferencia directa de archivos grandes; el modal limita el lote a 2.5 MB. Recuperación persistente de lotes parcialmente subidos.
- Plantillas/proyectos: medios, columnas, tipos complejos y preproyectos.
- IA/voz: asistente contextual y ejecución autorizada de comandos.
- Notificaciones: lectura compartida de avisos de revisión entre dispositivos.
- PWA: trabajo offline y cola de cambios con resolución de conflictos.
- Google Calendar: excluido por petición del usuario; accesos rápidos de Meet disponibles.

No se afirma paridad total ni despliegue de esta entrega.

## Correcciones de la auditoría (2026-10-06)
- Protección de servidor para la fecha histórica de zREVISION.
- KPIs ejecutivos sin FTF ni suspendidas, ventana 09:30–18:00 y avance actual separado del avance del día.
- Resumen IA obtiene actividades y checks de Notion; no usa el JSON local como fuente.
- Pendientes de resultados privados por cuenta, con revisión y errores visibles; requiere migración 8. Los datos globales antiguos necesitan importación por propietario.
- Siguen pendientes la sincronización cloud de distribución del calendario/lectura de avisos y la conciliación del historial desktop.

- Lectura de avisos de revisión compartida por cuenta; actualización por sondeo/foco.
- Filtro de persona coherente con los KPIs. Apertura de archivos remotos devuelve error visible; acceso Windows local usa argumentos y carpeta configurada.
- La distribución del calendario todavía requiere sincronización cloud. El historial y las marcas antiguas del escritorio aún no están conciliados. No hay paridad total ni despliegue en esta entrega.
