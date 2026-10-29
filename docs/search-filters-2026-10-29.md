# Filtros y horario - 29 de octubre de 2026

## Checklist aplicado
- [x] Cambiar los nombres de orden para distinguir Fecha por hacer (agenda) de Última modificación (edición).
- [x] Agregar Hoy primero: actividades de hoy por hora ascendente; después vencidas y futuras; sin fecha al final. Conservar las agrupaciones y las terminadas al final.
- [x] En los órdenes por Fecha por hacer, mantener las horas ascendentes dentro de cada día, incluso al ordenar los días posteriores primero.
- [x] Interpretar intervalos, fechas DD/MM/AAAA y fechas sin hora con la jornada de México. Recalcular el día al pasar medianoche sin sincronizar el índice completo.
- [x] Dar menor énfasis a filas futuras: fecha tenue y sin el resaltado fuerte de coincidencia; conservan selección y navegación.
- [x] Mejorar los selectores con descripción, opción actual, grupos de opciones, búsqueda, selección clara y teclado.
- [x] Corregir Software para buscar dentro de Revisiones, sin mezclar la base Programas y Proyectos.
- [x] Badges D/P pequeños, sin texto permanente ni fondo fuerte; explicación en hover y etiqueta accesible. Solo con dominio explícito d./p., manteniendo la corrección previa.
- [x] Migrar una vez las preferencias antiguas de orden de fecha al nuevo Hoy primero. Las elecciones nuevas y los órdenes alfabéticos o de modificación se conservan.

## Detalles adicionales mencionados en la transcripción
- Se comentó que alguna apertura desde el buscador parecía abrir otro registro. No se identifica una página o una secuencia reproducible; requiere comprobar un caso concreto antes de afirmar una corrección.
- Se propuso facilitar localizar la actividad rápida recién creada, posiblemente con favorito o acceso al calendario. No se definió cuál interacción se prefiere; no se activa un favorito automático.

La prioridad de hoy se planteó como posible segunda etapa en la reunión y se aplica ahora porque Neftali la solicita expresamente en sus notas. No se implementa una etiqueta vacía: se reemplaza el texto confuso por nombres y ejemplos de fecha/hora.

Validación: pruebas de hoy/mañana/ayer, horas ascendentes en ambos órdenes de días, intervalos, fecha mexicana, medianoche, ausencia de fecha, agrupaciones, terminadas, preferencias, filtro Software y badges. Una regresión antigua del 21 de octubre falla por esperar una lista de tipos de actividad ya ampliada antes de este cambio; sus pruebas de orden anteriores pasan antes de esa aserción.
