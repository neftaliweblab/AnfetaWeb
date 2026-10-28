# Tags de actividades y revisión

El catálogo vive en `src/services/activityTags.ts`. Los aliases de inicio de sesión y los identificadores de Notion/Supabase siguen en su configuración de identidad.

| Persona | Trabajo | Referencia | Revisión completa |
| --- | --- | --- | --- |
| Neftali | nne11 | ne11 | nneft |
| Genaro | gge11 | ge11 | ggena |
| Acalli | aac11 | ac11 | aacal |
| Karla | kka11 | ka11 | kkarl |
| John | jjo11 | jo11 | jjohn |
| Isaias | iis11 | is11 | iisai |
| Andrade | aan11 | an11 | aandr |
| Brian | bbr11 | br11 | bbria |
| Sotelo | sso11 | so11 | ssote |

El sufijo es 00 urgente, 11 primaria, 22 secundaria o 33 usar/practicar. El 33 no crea recordatorios automáticos. `is11` empieza con la letra i.

## Flujo

- Trabajo: `prtuzREVISION iis11`.
- Enviar a John: `rtuzREVISION is11 jjohn`, con John en la propiedad real de responsable.
- Devolver: `prtuzREVISION iis11 john`, restaurando la cuenta original de Notion.
- Aprobar: `zREVISION is11 john`, conservando la referencia del autor y la cuenta original.
- La copia visual usa los metadatos del flujo, no una segunda página de plantilla. Se recupera también en la carga básica del calendario.
- Un reenvío a la misma persona mientras está pendiente se rechaza antes de escribir o crear otro aviso.

Se conservan las prioridades, tags de terceros y contenido. Los títulos históricos siguen reconocidos, incluidos sufijos 0000, 001, 002 y 003. No hay migración ni renombrado masivo en Notion. Las nuevas altas usan el formato nuevo; las acciones sobre títulos antiguos mantienen sus tags históricos.

## Búsquedas y meses

Los tags estructurados se buscan por rol y prioridad: `iis11` no coincide con `is11`, y `jjohn` no equivale a `jjo11`. Las consultas nuevas reconocen los equivalentes históricos de su mismo rol. El responsable explícito prevalece sobre el título; el texto de descripción no asigna personas.

La selección automática muestra todos los meses. Al agrupar por mes se coloca primero el mes y año actual de México; luego los otros meses en orden descendente. Dentro de cada grupo van las actividades activas antes de las terminadas. El orden se calcula antes de paginar. Un filtro manual de mes sigue aplicándose.

## Verificación

`node --test scripts/activity-tags-regression.test.cjs scripts/review-title-regression.test.cjs scripts/activity-title-edit.test.cjs scripts/handoff-transcription.test.cjs scripts/quick-revision-upload.test.cjs scripts/search-defaults.test.cjs scripts/active-results-first.test.cjs scripts/workflow-safety.test.cjs`

`npm run test:calendar` prueba las rutas y mutaciones con Notion simulado. `npm run build` valida la compilación completa. No se escribe en Notion durante estas pruebas.


## Cierre de actividades (28 de octubre de 2026)

| Etapa | Responsable Neftali, revisor Genaro | Efecto |
| --- | --- | --- |
| Creada / por hacer | `nne11` | Tag activo y prioridad primaria. |
| En revisión | `ne11 ge000` | Responsable como referencia; Genaro tiene pendiente de revisión. |
| Devuelta | `nne11` | Se reactiva al responsable y se retira el tag del revisor. |
| Terminada / aprobada | `ne11` | Se desactiva el responsable y se retira el tag del revisor. |

El mismo cambio aplica a todas las personas y prioridades: `gge22 → ge22`, `aac00 → ac00`, `kka33 → ka33`, etc. Los códigos antiguos conservan compatibilidad (`nneft11 → neft11`). Se preservan descripción, dominio y prioridad.

El servidor normaliza los tags al finalizar incluso cuando no hay historial de revisión, tanto para plantillas como para actividades rápidas. Esta normalización ocurre después de componer el título y la urgencia, evitando reintroducir un tag activo durante el mismo guardado. Si existe historial, se restaura el responsable original y se quitan los códigos del revisor; sin historial no se inventa quién era el revisor, pero sí se retiran todos los tags explícitos de revisión y se desactivan los activos.

Los títulos de notificaciones `[RESPUESTA]` usan referencias, sin copiar tags activos ni tags pendientes de revisión del título original. Conservan su destinatario y enlace a la actividad; no son otra actividad activa.

La corrección se aplica al guardar la finalización. No se ha ejecutado una modificación masiva de actividades ya terminadas en Notion. La referencia pasiva permite conservar clasificación e historial; una búsqueda por tag activo debe buscar `nne11`, no una coincidencia parcial de `ne11`.
