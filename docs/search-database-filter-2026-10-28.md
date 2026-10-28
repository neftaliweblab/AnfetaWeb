# Buscador: bases y selectores

- **Agrupar → Base de datos**: reúne resultados según la base indicada en el índice. Conserva el orden de activas y terminadas y se aplica antes de paginar.
- **Base**: filtra una base concreta incluso con **Agrupar → Ninguno**. Comparte el ámbito de búsqueda existente y su preferencia por usuario; no añade un segundo filtro oculto.
- Las opciones se obtienen de las bases presentes en el índice de Notion. El filtro usa `sourceName` y sus equivalentes, nunca palabras del título.
- Seleccionar **Todas las bases de Notion** elimina la restricción a una base; los demás filtros (persona, mes, búsqueda, favoritos) se conservan.
- Los selectores de Base, Agrupar y Mes ahora usan un panel común: búsqueda de opciones, selección resaltada, descripciones, cierre, Escape, foco y desplazamiento en pantallas pequeñas.
- No se realizan nuevas peticiones de sincronización por abrir los selectores o cambiar de agrupación.

Verificación: pruebas de filtro exacto, Dropbox, fuente numérica Notion, agrupación antes de paginar, activas primero, preferencias e hidratación del selector; pruebas existentes de orden, filtros iniciales y búsqueda personal; TypeScript y compilación de producción.
