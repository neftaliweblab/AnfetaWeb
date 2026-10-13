# Reducir el catálogo acumulado

El resultado del proyecto muestra 1,277 MB en notion_index_chunks y 69,289 filas estimadas. Las demás tablas son mucho menores. Esto identifica el espacio, no demuestra por sí solo la causa del timeout de Auth.

SQL16 conserva las condiciones de SQL15 y permite hasta 2,000 lotes por llamada. No hace ninguna eliminación al instalarse. Conserva cualquier generación referenciada desde snapshots y las ejecuciones en curso. Solo elimina lotes sin referencias de ejecuciones terminadas hace más de una hora. No borra páginas de Notion, preferencias, checklist ni cuentas.

Después de instalar SQL16, ejecutar una llamada en una transacción con statement_timeout de 8 segundos y lock_timeout de 1 segundo. Si hay timeout, detenerse; no lanzar un bucle. Si elimina 2,000, puede haber más; si devuelve 0, no hay candidatos elegibles en ese momento. La limpieza automática de la aplicación permanece en 100 por actualización.

No ejecutar VACUUM FULL bajo saturación: reescribe y bloquea la tabla y necesita espacio adicional. El borrado normal permite reutilización; el tamaño asignado no necesariamente baja inmediatamente. Medir después conexiones activas y rendimiento, y planificar recuperación de espacio físico por separado si fuera necesaria.

Prueba local: migración repetible, límite máximo validado, permisos restringidos, paginación, referencias y ejecuciones activas conservadas. No aplicado desde esta sesión al proyecto real.
