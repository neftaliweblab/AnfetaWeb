# Plantillas — diagnóstico por código, 27 de octubre de 2026

La API permite leer la página Reporte del mes ADS (`0c2abd7d-91b7-822c-952b-81bcbffb6de4`), sus propiedades y sus dos columnas. El bloque sincronizado `392abd7d-91b7-8042-9d94-f04a081c81b8` referencia al origen `2eeabd7d-91b7-81e6-b5c2-c96e445da00d`.

Las consultas directas de la API devolvieron:

- Página/columnas y metadatos de la copia sincronizada: HTTP 200.
- Origen, hijos del origen e hijos de la copia local: HTTP 404 object_not_found.

Esto reproduce el fallo sin navegador ni modal. Notion no permite distinguir con esta credencial entre origen eliminado y página original sin acceso. No se puede copiar contenido que la integración no puede leer; omitirlo produciría una actividad incompleta.

## Pruebas reales de lectura y preparación

`scripts/audit-live-templates.cjs` consulta el catálogo y ejecuta el mismo plan de copia. Bloquea cualquier HTTP distinto de GET; no crea actividades, sube archivos, modifica plantillas ni cambia permisos. Usa NOTION_TOKEN o settings.json sin imprimir la credencial.

| Plantilla | Acceso / estructura | Checks accesibles | Columnas | Transferencias pendientes |
| --- | --- | ---: | ---: | ---: |
| Reporte del mes ADS | Origen inaccesible | 28, incompleto | 2 | No evaluadas |
| Reporte de mes SEO | Compatible | 42 | 2 | 2 |
| Sitio web no refleja cambios | Compatible | 0 | 2 | 0 |
| Requerimientos Proyectos Cliente PreProyecto | Compatible | 0 | 2 | 0 |
| Google maps ads plan pasos | Compatible | 38 | 2 | 2 |

Se revisaron cinco de las cien plantillas, no todo el catálogo. Las transferencias de archivos pendientes requieren una creación real para confirmarse. Las propiedades se consultaron; no se probó su escritura en producción.

## Cambios

El calendario y el buscador permiten verificar permisos, todas las secciones accesibles, orígenes sincronizados y compatibilidad de la copia antes de crear. La auditoría incluye todos los errores encontrados, con enlaces al bloque local, y no altera Notion.

El plan de preparación se comparte con la creación real. Solo la creación ejecuta transferencias y escritura de bloques. Las copias siguen materializando los sincronizados accesibles como contenido independiente y mantienen ambas columnas. Si no se puede leer ni origen ni copia local, la creación se detiene antes de crear una página incompleta.

## Pendiente en la plantilla ADS

Abrir la página original del bloque sincronizado y compartirla con la integración; si el origen fue eliminado, restaurarlo. Si el contenido aún se ve desde una cuenta con acceso, convertirlo en bloques independientes dentro de la plantilla, conservando ambas secciones. Luego verificar y probar la creación real completa. No se modificaron ni inventaron contenidos para sustituir el origen perdido.

## Validación automatizada

- Auditoría de acceso: columnas, checklists, caché por origen, fallback local, referencias circulares y permisos.
- Preparación de lectura: cero escrituras o transferencias, rechazo de origen inaccesible y tipos incompatibles.
- API: autenticación existente, validación de ID, preparación de copia y ausencia de escrituras.
- Regresiones: dos columnas con 360 checks, sincronizados con 650 bloques, tablas, archivos, lotes y cancelación.
