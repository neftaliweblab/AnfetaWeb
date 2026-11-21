# Reporte diario ANFETA

## Entrega
- Lunes a viernes, 18:30 de America/Mexico_City. Cron UTC: `30 0 * * 2-6` (el lunes de CDMX ya es martes UTC).
- Se conserva el reporte semanal del viernes; ese día llegan dos reportes con asuntos distintos.
- Se reutilizan destinatarios y proveedor del semanal: `FTF_REPORT_EMAIL_TO`, remitente opcional `FTF_REPORT_EMAIL_FROM`, SMTP o Resend. No se guardan claves en el código.
- El cron exige `CRON_SECRET` de al menos 32 caracteres y un robot con permiso de Dirección. No depende de tener ANFETA abierta.
- El horario del cron es la hora programada; la plataforma puede iniciar la ejecución después. El guard impide enviar antes del corte.

## Contenido
Solo se consulta el día reportado. Se muestran personas, primera conexión, última señal real, horas asignadas, terminadas, en revisión y pendientes, verificación FTF, cierre registrado y actividades pendientes con enlace único. Una última señal no equivale a salida confirmada y la falta de evidencia se indica como Sin registro.

## Historial y seguridad
`daily_report_deliveries` conserva fecha, destinatarios, instantánea, estado, intentos, historial y respuesta del proveedor. RLS activo; acceso exclusivo del servidor. Los envíos aceptados no se regeneran ni se reenvían. Un envío incierto requiere revisar el proveedor, porque SMTP no ofrece garantía de entrega exactamente una vez. Los rechazos seguros o fallos de generación permiten otro intento tras 15 minutos, máximo tres intentos totales. No hay un cron adicional de reintento; puede volver a invocarse el endpoint protegido. La instantánea queda almacenada antes de contactar al proveedor.

## Comprobación y recuperación
`GET /api/jobs/ftf-report?dryRun=1&date=YYYY-MM-DD` con autorización del cron genera una vista previa sin mandar correo ni crear entregas. Sin dryRun envía el día solicitado, sujeto al corte, día hábil e historial de envíos. Nunca envía fechas futuras. La API devuelve errores de configuración o entrega sin presentarlos como éxito.

## Validación
Pruebas SQL con PGlite: horario CDMX y fin de semana, fecha inválida, HTML, consulta de un día, permisos, snapshot previo, repetición, rechazo, entrega incierta, dryRun, token y lease. Se probó lectura real del 20 de noviembre con nueve personas sin enviar correo. La configuración de correo local está vacía; producción debe conservar las variables utilizadas por el reporte semanal.

## Estado de infraestructura al implementar
El 20 de noviembre de 2026 el dominio canónico y el endpoint semanal existente respondieron HTTP 402 con `DEPLOYMENT_DISABLED` y Payment required de Vercel. Esto ocurre antes de ejecutar los endpoints; no permite confirmar ni ejecutar correos en producción mientras siga deshabilitado. La configuración local carece de destinatarios y proveedor de correo; el nuevo job reutiliza las variables de producción del semanal. No se copiaron ni modificaron credenciales. La migración diaria fue aplicada al Supabase de destino y se verificó RLS sin lectura para authenticated.
