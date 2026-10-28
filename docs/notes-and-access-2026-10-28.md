# Notas, accesos y empalmes - 28 de octubre de 2026

## Alcance ajustado por Neftali
- Las plantillas originales de Notion solo se consultan. No renombrarlas ni modificar sus bloques.
- Se retira el punto de numeración de fases.
- La captura rápida se convierte en notas: primero texto e imágenes; al finalizar, crear una página.
- Ante un empalme, ofrecer aceptar el traslape o usar un horario libre cercano.

## Implementado
- Icono de Notas en las herramientas de ANFETA y en el calendario independiente.
- Borrador por usuario en IndexedDB; texto e imágenes, sin crear páginas ni horarios mientras se redacta.
- Guardado local con pausa de 600 ms, al cerrar y antes de crear. Hasta 6 imágenes y 2 MB en total; Ctrl+V y selección de archivos.
- Título, texto, clasificación Proyecto/Documentación, dominio opcional, base de destino y responsable.
- Creación explícita de página sin horario inventado. Clave de entrega por usuario y borrador para recuperar resultados confirmados sin repetir la página. Ante resultado incierto se conserva la nota y se exige verificar el destino antes de preparar otro intento.
- Actualización puntual del buscador con la página confirmada, sin sincronización completa.
- Asignación rápida de portapapeles y creación manual de actividades: selector de empalme, horario más cercano o cancelación. Se conserva el contenido y solo se reenvía ante un conflicto explícito anterior a cualquier escritura. No se reintentan automáticamente fallos de red o guardados inciertos.
- Los controles existentes de calendario, agenda y edición mantienen sus opciones de empalme/horario cercano. Los permisos y la validación de fechas siguen vigentes.
- Accesos permanentes por persona en la fila de limpieza de respuestas; cada uno abre una pestaña nueva y conserva las consultas existentes.
- Bases originales: consulta bajo demanda de los enlaces reales de Notion, con caché breve; separada de los filtros internos.
- Clasificación p./d.: filtro, badges de color y dominio real sin confundir la clasificación con un subdominio al abrir enlaces.
- Catálogo local de títulos actualizado desde las 100 páginas originales consultadas. Se conserva su clasificación y sufijos al generar actividades, con compatibilidad para n-ne11 / g-ge000 y códigos anteriores.

## Comprobaciones reales de solo lectura
- 100/100 páginas del catálogo accesibles; ninguna archivada.
- 98 títulos cambiaron respecto a la copia local; 95 incluyen diferenciador p./d.
- Cinco entradas sin ese diferenciador se conservaron sin inferirles una categoría: preproyecto, acceso a correo, acceso a dominio, Siteground y proyecto de biblioteca.
- Se confirmaron los enlaces originales de Revisiones, Clientes, Dominios, Programas y proyectos, Cobrar y pagar, y Correos Contraseñas.
- Saldo ADS no apareció en la búsqueda de bases accesibles para la integración. Falta su enlace y/o compartir la fuente con la integración; el selector informa la limitación.

## Verificación y límites
- Pruebas de clasificación, dominio real, nuevas anotaciones, responsables, plantilla rápida y conservación de sufijos.
- Pruebas de empalme permitido, horario cercano, cancelación, contenido conservado y cero reintentos ante respuesta incierta.
- Prueba del endpoint real con Notion simulado: 409 estructurado y ninguna creación antes de confirmar; una creación al aceptar empalme.
- Regresiones de subidas, tags, preferencias y búsquedas por usuario.
- No se crearon notas ni actividades de prueba en producción. La consulta de títulos no es una auditoría completa del contenido de cada plantilla.
