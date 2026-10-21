# Correcciones de borrado, revisión y reasignación rápida

## Causas encontradas

- La eliminación hacía PATCH directamente, sin comprobar si la página estaba archivada. Un registro ya archivado podía provocar un error aunque el resultado deseado ya existiera.
- El borrado por lote quitaba todas las filas seleccionadas incluso cuando el servidor informaba fallos parciales.
- El calendario, el índice y las respuestas antiguas podían volver a introducir registros confirmados como borrados.
- La retención del índice ante advertencias protegía contra resultados incompletos, pero también podía sobrescribir versiones nuevas con datos anteriores.
- La carga ligera podía desconocer el UpdatedAt del flujo, aunque el servidor ya tuviera metadatos de revisión. También se comparaban fechas inválidas de bloques históricos con fechas válidas.
- Las sugerencias de dominio volvían a extraer dominios del catálogo durante los renders del formulario.

## Implementado

- Lectura antes de archivar; página archivada/papelera confirmada cuenta como eliminación exitosa. Si el archivado cambia entre lectura y escritura, se vuelve a comprobar.
- Nunca se desarchiva para eliminar. Un 404 o un fallo de permisos no se interpreta como eliminación confirmada.
- Los lotes devuelven IDs confirmados y el cliente retira solo esos registros. Los errores pendientes se conservan hasta resolverse o reintentarse.
- Marcas de eliminación por cuenta en el navegador y una protección temporal en el servidor, con limpieza de selecciones, detalles, calendario y caché local. Las ventanas del mismo navegador reciben el cambio.
- Consultas acotadas cada 5 segundos en primer plano: hasta cuatro IDs por ronda, con rotación para listas largas. Se consultan páginas concretas, no todo el índice. Los fallos ambiguos no eliminan filas.
- Se reservan comprobaciones para registros borrados conocidos; una restauración confirmada en Notion retira la marca local y del servidor que atendió la consulta.
- Las comprobaciones también actualizan título, responsable, estado y fecha de modificación. Cuando una búsqueda por tag aún no tiene resultados, se inspeccionan candidatos de esa persona para no depender únicamente de las filas ya filtradas.
- Una respuesta antigua del índice no reemplaza una fila con fecha de modificación posterior. La paginación conserva los offsets originales aunque una página contenga filas eliminadas.
- Lectura previa del flujo antes de enviar, devolver o reasignar. Los datos desconocidos se verifican antes de enviar CAS; ante un conflicto real se actualizan los datos y se solicita confirmar de nuevo, conservando la selección del modal.
- Lectura fresca de metadatos en las mutaciones y selección correcta del bloque con fecha vigente sobre un bloque histórico sin UpdatedAt.
- La revisión se refleja con el resultado confirmado, sin una copia optimista que cambie prematuramente responsable y tags.
- Desplegable de Responsable en detalle fijo y hover: equipo activo, sin Emmanuel, permisos vigentes, petición única, confirmación y error visible. Reutiliza handoff con note vacío y leaveVisualCopy:false. Mantiene el modal completo.
- Compatibilidad de variantes cortas 000/0000 con urgencia 00, para todos los integrantes y sin migración de títulos.
- Extracción de dominios memorizada por catálogo; al escribir solo se filtran las sugerencias ya extraídas.
- Tipos frecuentes, Otro y los órdenes por fechas ya existían: se conservaron y se ejecutaron sus regresiones. Más recientes primero es fecha descendente.

## Límites y pendientes

- Cinco segundos es el intervalo de consulta, no un SLA global. Una lista de más de cuatro registros requiere varias rondas; la latencia, pestañas ocultas y límites de Notion pueden ampliar el tiempo.
- No se implementó un webhook ni un servicio central de eventos que garantice propagación inmediata a todos los dispositivos. La protección del servidor está acotada y en memoria; la persistencia del navegador es por cuenta. La copia compartida se invalida y se reconstruye mediante la sincronización existente.
- Si Notion devuelve 404, no se puede distinguir con seguridad entre ausencia definitiva y pérdida de acceso. Se conserva el registro como no verificado y se requiere comprobar acceso o reintentar.
- La reasignación usa el historial y migración existentes de activity_handoffs. Si esa configuración no está disponible en producción, se rechaza sin cambiar el responsable.
- No se han hecho operaciones reales contra Notion ni una revisión visual en la versión publicada. Queda publicar, verificar permisos reales y medir tiempos con sus datos.

## Validación

Pruebas de archivado idempotente, papelera, carrera de borrado, 404, permisos, ausencia de confirmación, resultados viejos, preflight, variantes 000, paginación filtrada, reasignación sin copia, doble envío, error y permisos. Se conserva la regresión de handoff con la misma página y conflictos de horario. Las rutas de API usan Notion simulado.
