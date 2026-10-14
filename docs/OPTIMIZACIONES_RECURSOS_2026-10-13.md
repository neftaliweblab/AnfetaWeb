# Recursos de ANFETA web

Implementado: vistas previas binarias Dropbox por streaming, sin caché de archivos completos. Detalles JSON limitados a 100 entradas/8 MB/15 minutos. Actividades recientes limitadas a 2,000 entradas/8 MB/1 hora y páginas recientes a 10,000 entradas/16 MB/1 hora. Los mapas eliminan vencidos al acceder y expulsan los menos usados al alcanzar límites; no reservan estos tamaños al arrancar.

Las lecturas de contenido Dropbox que necesitan texto tienen máximo 8 MB, incluso sin Content-Length; se cancela la lectura al alcanzar el límite y se indica abrir el archivo en Dropbox. Esto no restringe el tamaño de las descargas transmitidas por streaming.

Vercel no escribe index_cache.json durante la sincronización cloud. El índice no crea otra generación únicamente porque cambie el orden de las respuestas de Notion. Conserva la multiplicidad y detecta cambios en cualquier campo; la primera sincronización tras esta versión puede actualizar el hash almacenado una vez.

Pendiente: reemplazar generaciones por actualizaciones individuales, catálogo compartido por integración con aislamiento verificado, sesiones de subida desde el navegador (el fraccionamiento actual ocurre después de recibir todo el archivo), exploración Dropbox por cursor sin el corte de cinco continuaciones y retención de snapshots antiguos. No se afirma que esas partes estén implementadas ni que sea imposible alcanzar límites de un plan gratuito.

La reducción de cachés es por instancia de servidor; múltiples instancias siguen consumiendo recursos. Los datos ya acumulados requieren mantenimiento de base. El timeout Auth debe verificarse después de recuperar el servicio. No se borraron datos de producción.
