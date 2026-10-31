# Navegación rápida del buscador

- Al crear, seleccionar o cerrar una pestaña, se enfoca el campo principal al final de su consulta, sin borrarla. También al elegir persona o filtros de base, estado, mes, agrupación, clasificación y orden.
- La búsqueda personal permanece fija. Cerrar una pestaña activa selecciona la vecina, conservando las demás consultas. Se conserva el límite existente de 30 pestañas.
- Búsquedas guardadas enfoca su filtro al abrir; el selector pequeño de opciones ya enfocaba su buscador y mantiene ese comportamiento.
- Botón de teclado fijo al inicio del campo principal, fuera del carril horizontal de pestañas. Abre ayuda con explicación, tabla de comandos y selector activados/desactivados. Ctrl+Alt+T crea una búsqueda; Ctrl+Alt+W cierra la activa. Preferencia local por usuario en este navegador. La pestaña activa se mantiene visible al crear, cambiar o cerrar búsquedas.
- Se retiró la opción Chrome y se migra su preferencia a compatible. ANFETA nunca captura Ctrl+T/W: pertenecen al navegador y Ctrl+W puede cerrar la pestaña de ANFETA. Fuente: https://support.google.com/chrome/answer/157179. La ayuda distingue cerrar una búsqueda de eliminar una actividad y advierte de atajos reservados por otras aplicaciones.
- Atajos activos únicamente en el buscador, sin modal abierto ni edición de otros campos; ignoran repeticiones, composición IME, AltGraph y combinaciones distintas. Sin sondeo ni sincronización de datos adicional.

Validación: TypeScript, build de producción y regresiones de navegación, foco, restauración personal y búsquedas. Pruebas de eventos con DOM simulado; falta comprobación manual de comandos reservados en cada navegador/sistema.
