# Correcciones de funcionamiento — 13 de octubre de 2026

Cambios locales en ANFETA Web. No publicados desde esta tarea. No se aplicaron migraciones en producción ni se modificaron actividades reales para probar.

## Implementado

- Cola offline en IndexedDB, registros individuales por UUID confirmado, confirmación de persona antes de reenviar, coordinación entre pestañas, backoff y plazos de red. Un fallo conserva el resto del lote y las altas concurrentes. Conflictos se conservan como fallidos, sin descartarse después de cinco intentos. La cola antigua sigue intacta en localStorage y puede descargarse; no se atribuye a una persona sin evidencia.
- Checks, edición/horario/estado simple de actividad y edición/completado de recordatorios pueden quedar pendientes sin conexión. Se muestran como pendientes; no se presentan como guardados en Notion. Creación, envío/devolución de revisión, eliminación y posponer requieren conexión. Los reintentos usan recibos de servidor para no repetir una operación confirmada.
- Ajustes confirma PATCH y la persona devuelta antes de actualizar pantalla/localStorage. El error permanece visible. Se retiró Todos del selector de identidad; continúa disponible como filtro de resultados.
- Token de Notion eliminado de URLs de calendario; cabecera privada conservada. El índice consulta el token actualizado al refrescar tras cambios de Ajustes.
- Estados financieros negativos no se pintan como pagados/cobrados; parcial tiene su estado. La propiedad de responsable tiene precedencia cuando identifica a una persona válida; los tags sirven de respaldo.
- Envíos de revisión guardan ronda y nueva fecha de envío. El aviso anterior no se reutiliza. La caché se publica después de confirmar metadatos y se elimina al restaurar la página por fallo. El cliente retira también su resultado optimista fallido.
- Bloqueo distribuido de mutaciones/checks mediante Supabase. Comparaciones de título, estado, persona, flujo y horarios detectan datos antiguos cuando los consumidores envían esas condiciones. Lotes de horarios requieren horario y título esperados. Notion no ofrece una transacción conjunta de página/bloques; si queda un resultado incierto se exige revisar antes de repetir.
- Texto de nuevas páginas se divide en bloques sin cortar caracteres Unicode; tamaño excesivo se rechaza explícitamente. Actividades programadas establecen Estado POR HACER y título coherentes; no dependen del estado por defecto.
- Bridge Windows comprueba HTTP y espera hasta 3 segundos antes del protocolo alternativo.
- Subidas conservan archivos, plan congelado, ID estable y recibos por persona en IndexedDB. Al retomar el lote, pasos confirmados se recuperan del servidor. Un resultado incierto se bloquea para no crear duplicados; debe conciliarse con el destino antes de repetir. Un borrador antiguo global no se mezcla automáticamente con otra persona.
- Push retorna aceptados/fallidos/omitidos. Las alarmas usan recibo por recordatorio/revisión/suscripción y contemplan vencidos de días anteriores. VAPID ausente no declara éxito. La aceptación del proveedor no demuestra lectura en el dispositivo. Un timeout ambiguo se conserva sin reenvío automático.
- Preferencias ya no crean perfiles durante lecturas, no usan el UUID común como respaldo ni inventan una revisión exitosa si falla el RPC. Una lectura fallida de Supabase no recupera silenciosamente preferencias antiguas de Notion.

## SQL necesario antes de desplegar

Aplicar únicamente `supabase/migrations/202610130014_reliable_operations.sql` sobre el proyecto existente, después de verificar sus migraciones previas. Crea tablas privadas de bloqueos/recibos y RPC exclusivas de service_role. No repetir ANFETA_NEW_PROJECT.sql. SQL14 se probó dos veces sobre PostgreSQL en memoria con permisos y exclusión entre propietarios.

Sin SQL14, los cambios coordinados se rechazan con un error visible; no se promete recuperación duradera desde una tabla inexistente.

## Programador de alarmas

El programador externo debe continuar `nextOffset` hasta null en `/api/jobs/reminders`, usando CRON_SECRET en Authorization. El lote se limita a 20 y devuelve continuación si se acerca al plazo. Se incluye `scripts/dispatch-reminders.cjs`; recibe ANFETA_WEB_URL y CRON_SECRET del entorno, sin imprimir el secreto. Hay que configurar la ejecución periódica en el servicio de despliegue; no se configuró un cron externo en esta tarea.

## Validación

- Build de producción y pruebas de regresión; permanecen siete avisos existentes de trazado del disco Dropbox.
- Pruebas nuevas: cola completa tras fallo, altas concurrentes, aislamiento y legado; SQL14 repetible, exclusión y recibos; rondas, rollback, conflicto de estado y texto Unicode; push real frente a omitido/incierto; preferencias sin respaldo de identidad ni éxito falso; borradores con archivos por dueño; bridge HTTP y timeout.
- Notion real, solo lectura, 13/10/2026: 112 actividades, 12 registros financieros (6 cobros/6 pagos), 3 registros con responsable financiero reconocido y tres checklists (20, 0 y 26 tareas). Lectura total 10.7 segundos. Configuración local, no prueba de variables de Vercel.
- Vercel público: `/` HTTP200 en 343ms y `/api/auth` HTTP200 en 295ms, sin cookies. No se accedió a logs privados ni se confirmó login de producción.

## Pendiente con entorno real

- Publicar el código y aplicar SQL14; verificar variables y logs de Vercel.
- Login y cambio entre personas, regreso tras 15–30 minutos de inactividad y dos dispositivos.
- Envío/aprobación/devolución real, contingencia de Notion y conciliación de resultados inciertos de subidas/push. No se modificaron registros compartidos solo para obtener una prueba verde.
- Comparar la misma fecha, IDs y permisos con escritorio. Las lecturas anteriores no certifican paridad total.
- Configurar VAPID y programador de alarmas; validar PWA cerrada en dispositivos reales.

La revisión automática rechazó inicialmente reemplazar la cola porque el legado no quedaba accesible. Se resolvió conservando su almacenamiento y añadiendo descarga para revisión; ningún cambio antiguo se borró o asignó automáticamente.
