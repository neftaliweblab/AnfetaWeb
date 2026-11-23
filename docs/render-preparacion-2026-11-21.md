# Preparación de ANFETA para Render Free

- Un Web Service Node, plan free explícito; conservar Supabase fkncxpzyztdstnnmywqt. No crear otra base ni un Cron Job de pago.
- Fuente: https://github.com/neftaliweblab/AnfetaWeb, main. Build: npm ci && npm run build. Start: npm run start -- --hostname 0.0.0.0 (Next lee PORT de Render). Node 22.x. API de salud: /api/health, sin lecturas externas.
- Configuración: copiar las credenciales vigentes a Render por un canal privado; no versionarlas. Se requieren NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, ANFETA_SHARED_AUTH_USER_ID, NOTION_TOKEN; CRON_SECRET para las tareas. ANFETA_PUBLIC_URL será la URL de Render. Los enlaces aceptan RENDER_EXTERNAL_URL como alternativa.
- Render Free duerme tras 15 minutos sin tráfico. El primer acceso puede tardar aproximadamente un minuto. No se añadirá tráfico de mantenimiento para mantenerlo despierto.
- Render Free bloquea puertos SMTP 25/465/587. ANFETA_DISABLE_SMTP=1 impide usar el SMTP actual; configurar RESEND_API_KEY y FTF_REPORT_EMAIL_FROM con remitente verificado para correo HTTPS. No anunciar los correos como operativos hasta probarlos.
- vercel.json no programa tareas en Render. Preparar un disparador externo gratuito con secreto independiente y deduplicación; comprobar límites de GitHub Actions del repositorio antes de activarlo. El horario de un scheduler gratuito no implica garantía de puntualidad.
- Antes de declarar migración completa: verificar login, selección de usuario, lectura de Notion, búsqueda, calendario, escritura reversible de prueba, subida, archivos, enlaces, reportes y plan/memoria. Los archivos locales son efímeros; Supabase sigue siendo el almacén compartido.
- Revisar los cron anteriores de Vercel antes de reactivar ese proyecto para evitar ejecutar dos schedulers en paralelo.

## Despliegue realizado
- Servicio gratuito: https://anfeta-web.onrender.com, workspace confirmado My Workspace, ID srv-dc16umqjnfac73ftc230. Supabase existente conservado.
- Node 22, arranque next start en 0.0.0.0 con PORT proporcionado por Render, despliegue automático desde main.
- Corregido el origen de solicitudes detrás del proxy: solo los dominios HTTPS configurados del servicio se aceptan; no se confía en x-forwarded-host recibido.
- Variables privadas cargadas por el usuario en Environment; despliegue y prueba real de Notion/Supabase con nueve personas y sin mandar correos completados.
- GitHub Actions prepara las llamadas externas para las tareas: ANFETA_RENDER_SCHEDULES_ENABLED activa reinicio/preparación FTF; ANFETA_RENDER_REPORTS_ENABLED habilita los correos únicamente cuando el proveedor HTTPS esté configurado. Ambos se activan por separado, y el modo manual dry_run no envía mensajes.
- Pendiente: RESEND_API_KEY, FTF_REPORT_EMAIL_TO y un FTF_REPORT_EMAIL_FROM verificado. El SMTP actual no está habilitado en Render Free.
- Render comparte sus horas gratuitas entre servicios del espacio y puede dormir tras inactividad. No se cambió el chatbot existente ni se reactivó el puente de WhatsApp suspendido. GitHub Actions puede retrasar ejecuciones; no se garantiza el minuto exacto.


## Reportes por Gmail (puente externo)

Render prepara el reporte en `/api/jobs/report-mail`; GitHub Actions recibe solo el reporte y lo envía por Gmail SMTP. Las claves de Notion/Supabase permanecen en Render. No requiere dominio ni Resend. La contraseña de aplicación de Gmail se guarda exclusivamente como secreto privado de GitHub, nunca en código.

Secretos GitHub: `ANFETA_REPORT_SMTP_USER`, `ANFETA_REPORT_SMTP_PASS`, `ANFETA_REPORT_EMAIL_TO`. Reutiliza `ANFETA_RENDER_URL` y `ANFETA_RENDER_CRON_SECRET`. No crear secretos de Notion/Supabase para el runner.

Primero ejecutar manualmente `ftf-report`, fecha laboral existente, `dry_run=true`, `verify_mail=true`: valida acceso Gmail y genera vista previa sin enviar. Activar `ANFETA_RENDER_REPORTS_ENABLED=true` solo tras verificar esa ejecución. Diarios a las 18:30 CDMX de lunes a viernes; semanal viernes 18:30. GitHub puede retrasar horarios. La app puede necesitar despertar en Render Free.

El historial durable registra `sending` antes de entregar el contenido al runner; confirma `sent`, `failed` o `uncertain`. Solo se reintenta la confirmación, nunca el envío SMTP. Ante `uncertain`, revisar Gmail antes de repetir. Si el runner se interrumpe, la reserva vencida evita un segundo envío automático. La migración SQL de reportes existente es suficiente.

Pruebas: `node scripts/report-mail-relay.test.cjs`, `python scripts/test-report-mail-worker.py`, `node scripts/ftf-daily-report.test.cjs`, `npx tsc --noEmit`, `npm run build`.
