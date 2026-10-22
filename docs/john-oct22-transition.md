# Cambios solicitados por John — 22 de octubre de 2026

## Compatibilidad de revisión

La escritura habitual continúa usando los tags anteriores. No hay migración masiva ni cambio de nomenclatura obligatorio. Se reconocen además las marcas de revisión de dos letras y tres ceros para las nueve personas: ne000, ge000, ac000, ka000, jo000, is000, an000, br000 y so000.

Los tags nuevos son de revisión y no representan urgencia. Sus búsquedas son por token completo: ge00 no equivale a ge000; tampoco se encuentran dentro de dominios o palabras largas. Las variantes históricas de prioridad continúan compatibles.

Si un título o plantilla ya contiene la marca nueva, se conserva y se ajusta al revisor elegido junto con el tag anterior. Al cambiar de revisor se retira la marca anterior; al aprobar o devolver se limpia la marca pendiente. El ejecutor conserva el comportamiento anterior de referencia/activo. En títulos con nomenclatura nueva, un tag de trabajo del revisor se convierte en referencia para no confundir ejecución con revisión.

Los filtros rápidos incluyen trabajo, revisión con ambos formatos, y trabajo más revisión. Las búsquedas guardadas y los títulos existentes no se reescriben. Los helpers admiten un modo explícito `new` para la futura transición; ningún flujo lo activa por defecto.

## Buscador y horario

La coincidencia de búsqueda y el asignado aparecen en una franja independiente del título recortado, tanto en lista como en tarjetas. La coincidencia respeta los tokens de usuario completos y el asignado proviene del dato de asignación disponible.

Mover fecha/duración desde el buscador abre directamente el control compartido con calendario, sin pasar por otro menú de acciones. Incluye ayer, mañana, desplazamientos, fecha de destino libre y duración desplegable. Conserva hora de inicio, muestra vista previa y mantiene disponibilidad, permisos y comprobación de concurrencia del servidor. El editor de hora exacta sigue disponible.

## Pendientes

No se descartan operaciones locales por un error de validación. Se exige respuesta con la lista y una nueva revisión del servidor, incluyendo el alta/edición/borrado esperado, antes de retirar la operación de la cola. Las respuestas con revisión antigua no reemplazan el estado confirmado, incluso después de recargar. Los errores mantienen la copia local y permiten reintentar.

## Validación

Pruebas de transición para nueve personas, flujo anterior y nuevo, plantillas, OR y coincidencia exacta, aprobación/devolución y cambio de revisor. Pruebas de fecha libre/duración y markup de badges. Recuperación de pendientes ante error, respuesta antigua, confirmación incompleta, desconexión y conflicto de versiones. Comprobaciones de TypeScript, compilación de producción y regresiones de agenda, buscador y preferencias Supabase simuladas.

No se modificaron actividades reales de Notion para probarlo. La reproducción del fallo específico de la cuenta de John y la inspección visual con su sesión quedan para la comprobación funcional en producción.
