# Control de carga de Supabase — 13 de octubre de 2026

La captura muestra CPU 99%, Disk I/O 100% y una advertencia sobre el presupuesto de Disk I/O. Es evidencia de saturación; no identifica por sí sola qué consultas la provocan ni confirma una caída global de Supabase.

## Defectos corregidos

- El índice generaba lotes nuevos incluso si su contenido no había cambiado. Ahora compara la versión antes de guardar los lotes y conserva la generación activa cuando coincide.
- Las generaciones antiguas de lotes no se limpiaban al publicar. SQL15 incorpora una limpieza limitada a 100 lotes por actualización, únicamente de ejecuciones terminadas hace más de una hora y sin referencias desde ninguna copia. Protege las generaciones activas y en curso.
- La lectura de páginas concatenaba JSON repetidamente. Ahora agrega las filas una sola vez, manteniendo paginación y límite de bytes.
- Los procesos que perdían el bloqueo de sincronización ya habían leído el catálogo completo. Ahora reclaman el bloqueo antes de reconstruirlo.
- Las llamadas RPC repetían consultas fallidas hasta tres veces. Ahora tienen un límite de espera de 10 segundos y conservan la copia anterior ante errores.
- La vigencia del índice pasa a 10 minutos y la del calendario a 2 minutos. Las invalidaciones por cambios y las actualizaciones forzadas siguen activando la sincronización. El sondeo del navegador se reduce a 2 minutos y a 15 segundos mientras una sincronización está en curso.

## Aplicación en el proyecto existente

1. Ejecutar `supabase/migrations/202610130015_index_load_control.sql` en el proyecto existente, con las migraciones previas requeridas (1, 2 y 11) ya instaladas. No ejecutar la instalación completa ni crear otro proyecto.
2. Publicar este código después de SQL15. Sin la función nueva, la aplicación conserva la copia anterior y muestra que falta la migración.
3. Ejecutar una vez `supabase/DIAGNOSTICO_CARGA_SOLO_LECTURA.sql` y comparar tamaños, sesiones y ejecuciones con las métricas. No contiene escrituras ni cuerpos de actividades.
4. Comprobar acceso, sincronización, lectura de resultados y regreso tras inactividad en Vercel. El diagnóstico público `/api/auth?connection=1` informa host y conectividad sin devolver claves.

La limpieza no borra páginas de Notion, copias activas, perfiles ni historial de ejecuciones. Libera filas para reutilización; no promete reducir inmediatamente el tamaño asignado del disco. No se ejecutó en producción desde esta sesión.

## Validación y límites

Pruebas locales con 6,500 filas: publicación y lectura completas, contenido idéntico sin nuevos lotes, límite de bytes, limpieza acotada, protección de todas las copias referenciadas, protección de ejecuciones activas y permisos exclusivos del servidor. SQL15 puede ejecutarse nuevamente. Los tiempos del motor en memoria no representan la latencia de producción.

Todavía hace falta medir las tablas y consultas del proyecto real. No se han inspeccionado los logs privados de Vercel ni probado el acceso con credenciales reales; no se afirma que el login esté resuelto en producción.

Documentación oficial: https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io y https://supabase.com/docs/guides/troubleshooting/high-cpu-usage.
