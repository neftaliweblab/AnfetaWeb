# Corrección según transcripción de John

Fuente: CAMBIOS ANFE WEB DESKTOP.pdf, transcripción del 13 de octubre. Tramo relevante: 08:31–09:25 y 13:36–13:59. Se confirma que el panel derecho sin selección debe mostrar el calendario individual de la persona, con actividades por tarjetas, y permitir cambiar a detalles al buscar/seleccionar.

Corregido en ResultsViewHost/DetailsPane: ya no se selecciona una fila automáticamente al cambiar filtros. Si se pierde la selección, se muestra PersonalAgendaPane. Los botones superiores alternan agenda/detalles; seleccionar una fila vuelve a los detalles. Se mantiene el fijado de detalles mientras el resultado siga dentro del filtro.

La agenda usa la ruta existente de calendario básico para la fecha seleccionada, filtra por persona y ordena por horario. Incluye fecha, persona, actualizar, abrir Notion y acceso al calendario completo. Cancela peticiones al cambiar fecha/cuenta o desmontarse. No copia actividades ni crea otras tablas.

Pendiente posterior según 15:30–21:50: avisos de aprendizaje por persona con «ya lo aprendí», frecuencia configurable e intervalos progresivos. El documento los identifica como futuros; no se implementaron en esta corrección.

No requiere SQL nuevo. Validación local con TypeScript/build; pendiente revisión interactiva del usuario en Vercel.
