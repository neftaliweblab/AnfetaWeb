# Escritura inmediata en Buscador

Solicitud revisada: WhatsApp Video 2026-10-28 at 2.21.06 PM.mp4 (2:03).

## Implementado
- Al entrar al Buscador, se enfoca su campo de búsqueda si no hay otro control en uso.
- Al regresar a la ventana o pestaña, se recupera el foco cuando quedó en una zona neutral.
- Clic en un espacio vacío del buscador: permite continuar escribiendo.
- Escritura desde una zona neutral o una fila: lleva el carácter al buscador sin perder la primera letra.
- Conserva el texto y la posición de edición existentes; no vacía ni selecciona toda la consulta automáticamente.
- Conserva Tab / Shift+Tab y Enter para navegar y abrir resultados.
- No interfiere con campos, renombrado, contenido editable, botones, menús, modales, selección de texto ni atajos con Ctrl/Alt/Meta.
- Recuperación de respaldo a los 10 segundos de perder foco, únicamente si este quedó en una zona neutral. No hay sondeo periódico ni consultas de sincronización.
- Se limita al Buscador activo. No se aplica al Calendario: en el video se deja esa posibilidad para después.

## Validación
Pruebas del primer carácter, consulta conservada, edición, modales, selección, atajos, filas, retorno a la app, visibilidad y limpieza de listeners. También se ejecutan las pruebas del filtro por base y de la búsqueda personal.

Los cambios de agrupación por base y nuevos selectores preparados anteriormente se conservan. La publicación requiere la autorización que quedó pendiente tras el bloqueo de revisión automática del push a main.
