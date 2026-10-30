# Navegación rápida del buscador

- Al crear, seleccionar o cerrar una pestaña, se enfoca el campo principal al final de su consulta, sin borrarla. También al elegir persona o filtros de base, estado, mes, agrupación, clasificación y orden.
- La búsqueda personal permanece fija. Cerrar una pestaña activa selecciona la vecina, conservando las demás consultas. Se conserva el límite existente de 30 pestañas.
- Búsquedas guardadas enfoca su filtro al abrir; el selector pequeño de opciones ya enfocaba su buscador y mantiene ese comportamiento.
- Junto al + está Atajos: compatible (Ctrl+Alt+T/W), Chrome (Ctrl+T/W con Ctrl+Alt+T/W como alternativa) o desactivado. Preferencia local por usuario en este navegador.
- Ctrl+T/W pueden ser interceptados por Chrome/Brave antes de llegar a una web. No se promete sustituir comandos reservados. Fuente: https://developer.chrome.com/docs/extensions/reference/api/commands
- Atajos activos únicamente en el buscador, sin modal abierto ni edición de otros campos; ignoran repeticiones, composición IME, AltGraph y combinaciones distintas. Sin sondeo ni sincronización de datos adicional.

Validación: TypeScript, build de producción y regresiones de navegación, foco, restauración personal y búsquedas. Pruebas de eventos con DOM simulado; falta comprobación manual de comandos reservados en cada navegador/sistema.
