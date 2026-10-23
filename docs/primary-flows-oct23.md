# ANFETA — Flujos primarios del 23 de octubre, reunión 12:15

## Alcance implementado

El usuario autorizó dejar los nuevos flujos como predeterminados, conservando respaldo de los anteriores. No se realizó una migración masiva de títulos ni se modificaron plantillas o automatizaciones de Notion.

### Nomenclatura y revisión

- Interpretación primaria de saprtuzR (suspendida), aprtuzR (asignar), prtuzR (por hacer), rtuzR (revisar), tuzR (terminada aprobada), uzR (terminada con movimiento financiero pendiente), zR (cierre financiero según su nomenclatura).
- Tokens completos, tolerantes a mayúsculas y sin reconocer fragmentos dentro de palabras, dominios, correos o rutas.
- Una propiedad de estado reconocida de Notion tiene prioridad sobre un título contradictorio; la interfaz muestra discrepancia y no cambia Notion para resolverla automáticamente.
- ZS/Software, ZC/Cobro y ZP/Pago se clasifican sin inventarles siete etapas intermedias.
- Nuevas creaciones rápidas y cambios explícitos de fase de revisión usan la nomenclatura nueva. Enviar a revisión utiliza rtuzR y el tag nuevo del revisor; aprobar usa tuzR, nunca declara cobro/pago por el hecho de aprobar. Los estados disponibles de cada base se siguen resolviendo contra su esquema real.
- Calendario, agenda individual, tabla/tarjetas del buscador, agrupaciones y métricas consumen el mismo intérprete operativo. Descripción editable conserva códigos, dominio y tags.
- El detalle muestra campos numéricos/formulas/rollups de utilidad, ganancia, pérdida o margen presentes en la página recibida. Conserva el nombre original, cero y negativos. No calcula importes ni monedas ausentes ni inventa propiedades.

### Calendario incremental

- Compara versiones confirmadas de Notion y descarta lecturas antiguas o sin versión que intenten reemplazar propiedades versionadas. Los metadatos parciales tienen tratamiento separado.
- El guardado de una página no bloquea la entrega de deltas de las otras. El hub confirma IDs aplicados y conserva los conflictos por página.
- Combina deltas parciales, conserva versiones recientes y tombstones, evita resurrecciones y evita repetir una invalidación de contenido en cada actualización de propiedades.
- Las lecturas básicas explícitas pueden adelantar al enriquecimiento; un refresco solicitado mientras otra lectura básica corre queda pendiente.
- La protección de guardados acepta modificaciones confirmadas realmente posteriores, sin esperar los 60 s anteriores.
- Snapshots conservan altas ocurridas después del inicio de lectura. Las peticiones compartidas transportan su instante original, no el momento de llegada de cada consumidor.
- Carga inicial, agenda, tarjetas seleccionadas y difusión entre ventanas utilizan reconciliación por versión. Las respuestas del contexto anterior no deben aplicarse tras cambiar día/cuenta.
- Se mantienen los intervalos incrementales existentes; no se añade sondeo completo constante. Las lecturas de calendario superiores a 8 s dejan aviso diagnóstico acotado en Logs.

### Buscador y respaldo

- Consultas/pestañas v2 por usuario; primera pestaña personal y otras consultas conservadas. Se retira el límite que invalidaba el estado al exceder 31 pestañas.
- Filtros de persona, fuente, favoritos, agrupación, mes, vista, escala, orden y opciones de búsqueda se guardan por cuenta, después de restaurar sus preferencias.
- Claves v1 y preferencias globales anteriores no se sobrescriben. La migración de preferencias globales se limita al propietario legado identificado.
- El botón Recuperar búsquedas anteriores agrega las consultas del respaldo sin reemplazar las actuales ni duplicarlas.
- Persistencia de navegador; no se promete sincronización de preferencias entre distintos dispositivos.

### Dos asignaciones

- Botón naranja Asignación rápida conservado.
- Botón visible Asignación detallada invoca el mismo flujo existente de Ctrl+V, con Notion/Dropbox y crear/adjuntar.
- El acceso detallado cierra el panel rápido antes de abrirse; no reemplaza la grabadora ni elimina el atajo.
- Bloqueos inmediatos de envío previenen doble clic durante creación rápida y subida detallada. Permiso de portapapeles denegado abre el formulario vacío para pegado manual.
- Altas confirmadas se propagan por evento, evitando una recarga completa como notificación de guardado.

### Grupos relacionados

- El directorio/importación existente se mantiene; no WAHA, nuevos grupos, mensajes ni cambios de participantes.
- El detalle compartido por calendario y agenda/buscador muestra coincidencias por dominio completo. No asocia nombres parecidos ni hosts truncados, ni elimina subdominios arbitrariamente.
- Hay estados sin dominio, sin vínculo, coincidencia única y varias coincidencias. Los enlaces se validan; no se inventa un enlace por conocer el ID.
- Relación manual por dominio e ID/propietario del grupo, permitiendo varias. Se guarda en este navegador y puede quitarse; no altera Notion ni los grupos.
- Acceso al directorio requiere sesión; no se admite falsificar un usuario de escritura salvo las facultades existentes de Dirección. La lectura desde el detalle no inicia un respaldo remoto automático.

## Respaldo y reversión

- Base Git anterior a esta tanda: `1f69859`.
- Intérprete preservado: `src/services/activityWorkflowLegacy.ts`.
- Composición de revisión preservada: `src/services/reviewTitleLegacy.ts`.
- `NEXT_PUBLIC_ANFETA_LEGACY_WORKFLOW=1` más nuevo build/despliegue selecciona el intérprete y fases anteriores. Por defecto, la variable está ausente y los nuevos flujos son primarios. No es una credencial.
- Revisiones antiguas siguen siendo leídas; no se reemplazan sus títulos en segundo plano.
- El botón naranja y Ctrl+V siguen disponibles, y las búsquedas v1 permanecen recuperables.

## Validación

Pruebas sin servicios reales: siete etapas, fuentes contradictorias, aprobación sin liquidación ficticia, respaldo antiguo, identidad del revisor, edición de descripción, datos financieros presentes/ausentes, asociación exacta/múltiple/manual de grupos, permisos del directorio, 51 pestañas y recuperación sin pérdida, respuestas fuera de orden, cambios parciales durante guardados, altas durante snapshots, eliminación sin resurrección y 1500 tarjetas.

Suite histórica del calendario ejecutada en modo legado: 86 pruebas correctas. Flujo primario de API probado por separado, incluyendo envío, aprobación, restauración de responsable y rechazo/restauración ante fallo. Las peticiones a Notion y Supabase se simulan.

Límites de verificación: no se escribieron actividades/grupos reales para probar, no se verificaron automatizaciones externas de Notion y no se midió la latencia de producción. Un cambio externo no puede mostrarse antes de que Notion lo exponga y llegue a ANFETA. Las relaciones manuales de grupos permanecen locales; un catálogo de relaciones compartido entre dispositivos requerirá un almacenamiento posterior.
