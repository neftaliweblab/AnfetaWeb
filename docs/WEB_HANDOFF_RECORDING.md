# Reasignación, grabación y transcripción (Web)

## Publicación

1. Aplicar `supabase/migrations/202610150018_activity_handoffs.sql` antes de publicar la nueva interfaz. La tabla conserva snapshots visuales por transferencia, separados de la página original. Solo el servidor tiene acceso directo.
2. Configurar `GROQ_API_KEY` en el servidor si se desea transcripción opcional. Se utiliza `whisper-large-v3-turbo`, con consumo de la cuota del proveedor. No se expone la clave al navegador.
3. Publicar la aplicación web. No requiere cambios de Desktop ni de la extensión.

## Comportamiento

- **Reasignar actividad:** el responsable actual o Dirección pasa una actividad activa a otro perfil habilitado. Actualiza propiedades/título de la misma página de Notion. No clona el cuerpo. Conserva el estado y comprueba empalmes del nuevo responsable. Las revisiones pendientes deben resolverse antes.
- **Enviar a revisión final:** permite seleccionar cualquier integrante activo del equipo. La persona asignada puede aprobar o devolver esa revisión; esto no le otorga permisos globales sobre otras actividades.
- Emmanuel se retiró del directorio seleccionable, inicio de sesión, columnas, filtros y listas de equipo de la Web. No se borran páginas ni registros históricos de Notion.
- Revisión y reasignación usan tarjetas de integrantes con búsqueda por nombre, usuario y función. Sus modales se muestran fuera del contenedor del calendario, centrados y con scroll interno en pantallas pequeñas.
- Crear desde un hueco del calendario requiere doble clic. El botón Nueva mantiene su apertura con un clic.
- La nota de transferencia se conserva en los datos internos de la misma página y se muestra al siguiente responsable. Las copias históricas son de solo lectura, con horario y checklist congelados; no ocupan espacio para empalmes ni suman trabajo en indicadores. Se cargan por su propia fecha aunque la página original cambie de día.
- Si no se puede preparar el historial, la transferencia se rechaza antes de cambiar Notion. Si falla el guardado de metadatos se intenta restaurar la página; si falla la confirmación del snapshot, se informa explícitamente del cambio parcial.
- El grabador permite elegir micrófono y la superficie que ofrezca el navegador. Detiene a los 10 minutos o al alcanzar 128 MB, avisa cerca del límite y conserva la vista previa. Un archivo final mayor de 128 MB solo puede descargarse; su subida queda bloqueada. La configuración de bitrate reduce tamaño, sin recompresión posterior.
- Tras una subida exitosa de video aparece **¿Generar transcripción? Sí / No**. Solo al confirmar se extrae audio localmente y se envía a Groq en fragmentos WAV mono de un minuto. No se envía el video al transcriptor.
- Los fragmentos completados se conservan mientras el panel permanezca abierto, para reintentar sin retranscribirlos. La transcripción se añade al final de la misma página de Notion, bajo un bloque desplegable; Solo Dropbox guarda un TXT junto al video. Siempre se puede descargar el texto generado.
- Cada guardado en Notion utiliza un marcador determinista para evitar adjuntar dos veces la misma transcripción al reintentar. Los fallos de transcripción nunca borran ni repiten la subida del video. Si se cierra el panel o se recarga durante la transcripción, sus avances en memoria se pierden; el video guardado permanece.
- La transcripción requiere una pista de audio decodificable por el navegador. Una grabación sin micrófono puede no contener audio. Los errores se muestran sin afectar el video.
- El aviso de actualización permite posponer 5/15 minutos, 1/4/24 horas.

## Verificación manual con cuentas reales

La compilación de producción, TypeScript, las 64 regresiones del calendario y las pruebas de reasignación, grabación, subida, transcripción y migración pasaron localmente. Los proveedores externos se simularon. La compilación conserva siete avisos previos de acceso dinámico al filesystem en `/api/data`; no impidieron generar la aplicación.

Referencia del proveedor: [Groq Speech to Text](https://console.groq.com/docs/speech-to-text).

1. Transferir A → B → C con y sin copia; verificar mismo ID, título, adjuntos, checks y nota. Reabrir fechas anteriores después de mover el original y comprobar snapshots intactos.
2. Probar perfil inactivo, usuario ajeno, revisión pendiente, actividad bloqueada y horario ocupado: no deben transferirse.
3. Grabar desde distintas actividades en Chrome/Edge/Firefox con y sin micrófono; alternar módulos y detener desde el navegador. Revisar que el destino no cambie.
4. Subir a Notion/Dropbox y Solo Dropbox. Elegir No a transcripción; después probar Sí, error/reintento y guardar TXT. Verificar que no se duplica video ni texto.
5. Probar límites, permisos denegados y micrófono desconectado. Las pruebas automáticas simulan navegador/proveedores; no sustituyen estas comprobaciones reales.
