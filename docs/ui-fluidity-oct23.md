# Fluidez de interfaz — 23 de octubre de 2026

Se redujo el trabajo síncrono del calendario y del buscador:

- Formateadores de zona horaria reutilizados, conservando las reglas de Ciudad de México.
- Combinación de snapshots por ID, sin recorrer todo el día por cada actividad.
- Se conservan las referencias de tarjetas sin cambios para que React.memo evite renderizados.
- Caché acotada a 2048 tokens para interpretar tags y palabras repetidas; resultados independientes para el llamador.
- Empalmes calculados solo al cambiar actividades/personas/fecha.
- Eventos storage filtrados por la clave de páginas eliminadas del usuario.
- Listener del índice retirado al desmontar o cambiar de cuenta.
- Favoritos sin cambios conservan su Set y no repiten la búsqueda/ordenamiento.
- El reloj del calendario no actualiza una vista inactiva u oculta.

## Medición local

Mismo proceso Node, datos sintéticos, una muestra antes/después. No representa el tiempo total de carga ni una garantía para todos los equipos.

| Operación | Antes | Después |
| --- | ---: | ---: |
| 1200 pares fecha/minutos | 299 ms | 19 ms |
| 2400 lecturas de tags | 187 ms | 12 ms |
| Combinar 1200 actividades | 698 ms | 36 ms |

## Validación

- scripts/ui-fluidity.test.cjs: semántica de fechas, identidad de tarjetas sin cambios, eventos de almacenamiento, caché sin mutaciones compartidas y medición.
- scripts/calendar-instant-updates.test.cjs: deltas, cambios de día, espejos, checklists, snapshots antiguos y mensajes duplicados.
- scripts/oct23-primary-flows.test.cjs: flujos primarios y 1500 tarjetas.
- scripts/search-startup-floating.test.cjs: búsquedas personales.
- scripts/activity-tags-regression.test.cjs con NEXT_PUBLIC_ANFETA_LEGACY_WORKFLOW=1: compatibilidad anterior.
- Comparación diferencial local de 120 snapshots contra la implementación anterior: mismos datos serializados, incluyendo lecturas viejas, confirmaciones recientes, espejos y duplicados.
