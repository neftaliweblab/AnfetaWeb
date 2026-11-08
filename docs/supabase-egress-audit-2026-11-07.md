# Auditoría de transferencia Supabase — 2026-11-07

## Hallazgo corregido

El filtro global de respuestas de GET en /api/data llama getConfirmedDeletedPageIds.
Antes consultaba get_recent_notion_page_events(source, null, 1000): descargaba
propiedades completas de actividades, aun cuando solo necesitaba IDs borrados.
Además, el límite contaba eventos activos y podía omitir eliminaciones posteriores.

Ahora consulta notion_page_events con proyección page_id, filtro source_key +
state=deleted, orden por page_id y paginación de 1000. No descarga contenido,
checklists ni propiedades para este filtro. Con Supabase disponible, su estado
persistente manda: una instancia caliente no vuelve a ocultar páginas restauradas
por otra instancia. El modo local mantiene el comportamiento basado en memoria.
Los fallos no se interpretan como una lista vacía de eliminaciones.

## Medición de solo lectura

Tamaño JSON calculado en PostgreSQL sobre los datos actuales, sin enviar contenido
al diagnóstico: lectura anterior máxima 1,324,164 bytes; proyección de IDs 6,811
bytes. Reducción de 99.49% para esta consulta específica. No representa una reducción
del mismo porcentaje en toda la factura, ni confirma el origen de todo el consumo
histórico de la organización anterior.

## Flujos revisados

- Calendario: lectura básica + enriquecimiento; guardados y eventos disparan cambios
  dirigidos. No se alteraron los tiempos de actualización ni la escritura optimista.
- Eventos entre usuarios: mantienen su cursor incremental, notificación inmediata de
  guardado, pausa en pestañas ocultas y comprobación rápida del calendario.
- Índice: conserva páginas de hasta 500, versión conocida para respuestas sin cambios
  y sincronización acotada. La reconstrucción de índice para sincronizar sigue siendo
  una lectura grande; no se añadió una caché que pudiera ocultar cambios.
- Preferencias: varios controles consultan el mismo endpoint cada minuto. Posible
  trabajo posterior: coalescer por sesión con invalidación al guardar, midiendo antes.

No se ha reducido indiscriminadamente la frecuencia. Conviene observar Egress y
Log Ingestion del proyecto nuevo durante un día comparable antes de cuantificar
el ahorro global. No se cambiaron datos, RLS ni credenciales con esta corrección.
