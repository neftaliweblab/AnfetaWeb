# Contadores de checks que aparecían en cero

Causa reproducida en código: la pastilla principal utilizaba dailyChecklist, que solo acepta checks con fecha de marcado verificada del día. Los checks marcados en Notion sin historial verificado se excluían, por lo que la tarjeta podía mostrar cero aun teniendo checks marcados. No se había perdido el estado isChecked de Notion.

Cambios:
- La pastilla y su popup muestran los marcados reales / total del checklist, independientemente de su fecha.
- El avance confirmado para el día permanece separado: no se atribuyen a hoy checks de días anteriores ni de fecha desconocida.
- El detalle fijo y el calendario individual muestran el total marcado junto al cálculo diario.
- El popup recibe el checklist completo; ya no recibe solo los elementos filtrados del día ni pierde el historial al abrirlo.
- Se conserva la cantidad agregada cuando una respuesta tiene checklistItems vacío pero incluye contadores válidos; el cálculo diario usa los agregados diarios disponibles.
- La última edición del texto de un check no se presenta como si fuera su fecha de completado.

Pruebas: mezcla de checks antiguos, de hoy, sin fecha y pendientes; arrays vacíos con agregados válidos; popup; invariancia del historial y KPIs diarios.

Límite de validación: dos consultas de lectura a Notion desde esta máquina devolvieron HTTP 401 con las credenciales locales disponibles. No se ha confirmado el contador de una página real de la captura ni se atribuye ese rechazo a la sesión de producción. No se modificaron checks ni fechas de Notion.
