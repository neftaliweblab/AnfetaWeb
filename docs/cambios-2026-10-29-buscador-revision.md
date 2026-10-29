# Cambios del 29 de octubre: buscador y revisión

## Implementado

- Revisor previsto: `ge11`. Al enviar a Genaro: `gge000`. Urgencia: `gge00`. La misma regla aplica a las nueve personas configuradas.
- Se siguen leyendo revisiones anteriores con `ge000` y los tags históricos. Los nuevos envíos usan la inicial duplicada.
- Las anotaciones de plantilla (`nn-e11`, `gg-e000`, y formas anteriores como `n-ne11`) no asignan trabajo ni coinciden con búsquedas de tags activos. Al crear se activa al responsable elegido y se conserva su prioridad de plantilla; el revisor elegido queda como referencia.
- La aprobación elimina al revisor y conserva la referencia del responsable original; devolver reactiva al responsable. People y las copias de calendario se validan con pruebas de las operaciones reales usando Notion simulado.
- Los accesos por persona seleccionan una pestaña con la misma consulta; las consultas editadas se conservan. La primera búsqueda personal prioriza tags de trabajo y revisión recibida.
- Contador de pestañas, estrella de pendiente y recordatorios de 5, 10 y 60 minutos. El resplandor se reconoce al seleccionar la pestaña. Se guardan por usuario en este navegador, no como una automatización compartida.
- Selector de prioridades para el siguiente acceso por persona. Términos/grupos removibles y comandos Incluir, Excluir y Cualquiera. Los grupos booleanos se evalúan sin expandir combinaciones exponenciales.
- Orden de fechas con flechas Ayer → Mañana y Mañana → Ayer. Se conserva Hoy primero y el horario ascendente dentro del día.
- Por hacer usa una presentación uniforme sin modificar la propiedad real de Notion. Detalles tiene cierre dentro del panel.
- Dropbox agrega reproducción de audio/video bajo demanda y conserva PDF, imágenes y texto. No descarga archivos binarios para buscar texto al seleccionarlos. Las respuestas de archivo evitan la inspección JSON y las consultas de eliminados de Notion.
- Streaming por rangos para reproducción/consulta parcial, conforme al [formato oficial de descargas de Dropbox](https://docs.dropboxapi.com/riviera/docs/technical-reference/request-response-formats). El formato debe ser compatible con el navegador; Office conserva apertura/descarga.

## Verificación real de plantillas (solo lectura)

El 29 de octubre se consultaron las 100 páginas del catálogo: 100 accesibles, 75 títulos cambiados, 78 con anotaciones separadas por guion. Se actualizó únicamente el catálogo local con los títulos vigentes; no se modificaron las plantillas originales.

La lectura de página no implica que todos sus bloques sean accesibles. Se auditó además el contenido de Reporte del mes ADS (`0c2abd7d-91b7-822c-952b-81bcbffb6de4`): se leyeron 192 bloques y se encontraron 28 checks, pero la auditoría de copia falló en un origen sincronizado. Origen: `2eeabd7d-91b7-81e6-b5c2-c96e445da00d`; referencia: `392abd7d-91b7-8042-9d94-f04a081c81b8`. Requiere acceso al origen o desvincular ese bloque conservando su contenido desde Notion. No se creó una actividad de prueba incompleta.

## Validación y límites

- 93 pruebas de calendario y mutaciones pasaron con todas las solicitudes de Notion simuladas.
- Pasaron pruebas de los nueve usuarios, compatibilidad, ciclo de aprobación/devolución, búsquedas, agrupación booleana, recuperación de pestañas, catálogo rápido y streaming/rangos de Dropbox.
- Compilación de producción y revisión TypeScript.
- Falta validar con una cuenta real la reproducción de archivos privados de Dropbox y el flujo visual completo en producción. No se enviaron avisos al equipo ni se crearon revisiones reales durante las pruebas.
