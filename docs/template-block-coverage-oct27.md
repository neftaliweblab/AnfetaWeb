# Compatibilidad de bloques y estructura ADS — 27 de octubre de 2026

## Estructura comprobada en vivo

La sección izquierda de las columnas de Reporte del mes ADS es `heading_4`, con `is_toggleable: true` y contenido anidado. Se transforma en heading_3 conservando el desplegable y todos sus hijos. La derecha contiene un solo `synced_block`.

El segundo sincronizado contabilizado por la auditoría completa está dentro del desplegable **Asignador**, fuera de esas columnas. El diagnóstico ahora separa toggles, encabezados desplegables y sincronizados, e indica que el conteo incluye contenido anidado.

La credencial consultada pertenece a Asistente Anfeta Buscador. Con ella se probaron las versiones 2022-06-28, 2025-09-03 y 2026-03-11: las columnas devuelven 200 y el origen 2eeabd7d-91b7-81e6-b5c2-c96e445da00d devuelve 404. El permiso a la plantilla/base y el permiso efectivo al origen sincronizado son comprobaciones distintas. No se modificaron permisos ni contenido de Notion.

## Política común de tipos

- Copia nativa: párrafos, encabezados 1–3, listas, checks, toggles, citas, callouts, código, divisores, ecuaciones, marcadores, embeds, tablas/filas, índice, breadcrumb, imágenes, video, audio, PDF, archivos, columnas.
- Conversión independiente: sincronizados accesibles; encabezado 4 a 3 sin perder el desplegable; template antiguo a toggle; link_preview a bookmark; link_to_page a bookmark; child_page a toggle con contenido; tab a contenedor desplegable con sus secciones; child_database a bloque destacado callout (📊) con enlace directo a la base de datos de origen en Notion. Los iconos de las etiquetas de pestañas se conservan mediante callouts.
- HTML: embed.file_upload se conserva; archivos HTML internos se transfieren como archivos HTML. La prueba de lectura informa transferencias pendientes sin ejecutarlas.
- Restricciones explícitas: meeting_notes/transcription no se crean con el endpoint general de bloques. unsupported y tipos futuros no se descartan ni se envían como cuerpos inválidos.

No se promete copia universal de tipos que Notion no expone o no permite crear por este mecanismo. Un botón, formulario o base de datos no se reemplaza silenciosamente por contenido vacío.

Documentación: https://developers.notion.com/reference/block

## Validación

- template-block-types.test.cjs reproduce exactamente un desplegable y un sincronizado en dos columnas, conservando checks.
- Prueba subpáginas, pestañas con iconos, enlaces, HTML, tipos nativos y medios; reconoce límites de API sin escribir.
- Pasan las regresiones de preparación, transferencias, dos columnas con 360 checks y sincronizados con 650 bloques.
- La plantilla ADS aún requiere hacer accesible su origen para probar su creación real completa. Las conversiones de pestañas/subpáginas cambian el contenedor visual a toggle conservando su contenido.
