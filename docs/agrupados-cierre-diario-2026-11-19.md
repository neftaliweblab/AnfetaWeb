# Agrupados y cierre diario — 19 noviembre 2026

- En el checklist, **Todos sin fecha para hoy** programa únicamente pendientes sin fecha, en lotes de cinco. Cada lote comprueba de nuevo las fechas y el estado. Los completados y fechas ya asignadas se conservan. Para pasar TODOS los pendientes a hoy, activa **Incluir pendientes que ya tienen fecha**; se informa cuántas fechas cambiarán y se vuelve a comprobar que cada check siga pendiente. Ante un fallo se informa el avance y no se envían los lotes restantes.
- **Agrupar por fecha en Notion** muestra primero la vista previa. La confirmación conserva el contenido compatible e historial y crea/reutiliza desplegables de fecha fija. No se ejecutó ningún traslado real de checks durante esta entrega.
- **Confirmar terminado por hoy y avisar** exige el cierre de los pasos del día actual. Conserva horario y responsable. En Por hacer usa PPRTUZ; en revisión no aprueba ni altera el flujo de revisión. No sustituye la finalización definitiva.
- El aviso de John incluye autor, actividad, día y conteo; una segunda confirmación de la misma actividad/día no duplica el aviso. La notificación PWA depende de la configuración y permisos del dispositivo; el aviso persistente queda disponible en el panel.
- Pasar la actividad a otro día sigue siendo una acción independiente.
- La ayuda del checklist incluye un prompt seleccionable para usar en Notion. No renombra propiedades ni modifica todas las páginas para insertar instrucciones.

## Base de datos
Se aplicó `202611180001_checklist_grouping.sql` al destino Supabase configurado fkncxpzyztdstnnmywqt. Tablas verificadas con RLS activo y sin lectura para authenticated. No se alteraron títulos ni bloques de Notion para esta comprobación.

## Alcance pendiente
No se añadió un worker: John lo planteó como investigación. La ejecución sigue siendo explícita y con vista previa. Los bloques incompatibles se conservan y se reportan; el API no permite reparentar bloques directamente, por lo que el traslado implica nuevos IDs y requiere aceptar la advertencia. Comentarios y enlaces al bloque anterior no se transfieren automáticamente.
