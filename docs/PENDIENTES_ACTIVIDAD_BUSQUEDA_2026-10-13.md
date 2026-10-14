# Pendientes, actividad y búsqueda

Implementados los cuatro módulos en los componentes activos de ANFETA web. PendientesColumn es el panel usado; PendientesPane no está montado.

- Pendientes: completar, copiar con feedback, abrir URL/Notion cuando exista y eliminar directamente. Sidebar colapsable con cantidad activa y localStorage anfeta_pendientes_collapsed. Captura Ctrl+Espacio solo fuera de controles de edición, Enter/Esc, persona, p1–p4 y fecha relativa. Guarda a través de las preferencias existentes.
- Actividad: entrada compacta con resaltado, check y comentario. Elemento temporal con spinner; confirmación reemplaza el estado pendiente, error lo retira y conserva el texto. Checks aparecen en la lista y comentarios nuevos en el formulario. La integración Notion requiere capacidad de insertar comentarios; no se otorgan permisos nuevos desde la web.
- API: append children usa PATCH, no POST. Se verifica identidad y acceso a la página antes de escribir; texto de hasta 2,000 caracteres incluyendo el prefijo. Error incierto indica revisar Notion antes de repetir; no hay reintento automático de creación.
- Búsqueda: flyout desactivado, filtro pesado después de 400 ms o inmediatamente al pulsar Enter/botón Buscar. Selección automática en resultados/calendario al desaparecer la selección del conjunto visible. Detalle vacío ofrece seleccionar el primer resultado.

Pruebas locales de parser y payloads Notion simulados: fechas, persona, prioridad, resaltado, método PATCH, comentarios, permisos y límite de texto. TypeScript y build verificados. No requiere migración SQL nueva. Pendiente prueba interactiva con la integración real, especialmente su permiso de comentarios.
