# Reducción de consultas y Log Ingestion — 2026-11-11

## Diagnóstico

La captura muestra 1.14 GB ingeridos frente a 1 GB incluido. Log Ingestion mide los logs de los servicios de Supabase (API Gateway, Auth, Postgres, etc.); no equivale al tamaño de las tablas ni a los console.log del servidor Vercel.

Lectura de pg_stat_statements del destino, sin modificar datos: 162846 llamadas a get_recent_notion_page_events y 27309 consultas de IDs eliminados. Son contadores acumulados desde el reinicio de estadísticas; no permiten atribuir GB diarios ni identificar por sí solos qué servicio ingirió cada log. No se reiniciaron estadísticas, modificaron políticas ni desactivaron logs de seguridad.

## Cambios

- Autenticación: WeakMap por objeto Request reutiliza el resultado entre requireActor y los consumidores de presencia, mensajes y recordatorios. Una operación normal de esos endpoints pasa de dos verificaciones Auth y dos lecturas de perfil a una de cada una. Solicitudes posteriores vuelven a validar sesión/perfil. Se conserva x-anfeta-owner y la comprobación de acceso compartido.
- GET de datos: respuestas sin items ni activities (estado, unchanged, diagnósticos) dejan de consultar IDs eliminados. Las listas sí siguen filtrando eliminadas; sin TTL que retrase restauraciones.
- Sincronización incremental: ante fallos espera 8, 16, 32 y hasta 60 segundos entre intentos; no lanza sondeos adicionales a Notion tras fallar el canal de eventos. Conserva cursor/datos. Online, guardado y regreso a la ventana visible permiten comprobar de nuevo. Con servicio sano conserva la frecuencia existente: calendario 4 segundos, buscador 15 segundos. No cambia carga inicial ni mutaciones.

## Validación

Pruebas de identidad por solicitud, aislamiento, perfiles inactivos, filtrado de eliminadas, reintentos y recuperación; regresiones de mensajes, recordatorios, acceso compartido y calendario. La prueba de actualización instantánea esperaba los antiguos intervalos 2/10 segundos; se alineó con los 4/15 que ya tenía el código antes de este cambio.

## Límites y seguimiento

El consumo ya registrado no disminuye al desplegar. No se promete permanecer dentro de 1 GB: falta comparar el crecimiento diario después del despliegue y consultar el desglose por servicio/ruta en Logs de Supabase. El sondeo saludable de eventos sigue siendo el principal candidato por volumen de llamadas; reducirlo exige evaluar transporte compartido o notificaciones sin sacrificar rapidez. Este cambio evita trabajo redundante y tormentas de reintentos, sin espaciar más el calendario sano.

Referencia oficial: https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest
