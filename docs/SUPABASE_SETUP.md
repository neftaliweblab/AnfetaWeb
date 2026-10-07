# Activar Supabase en ANFETA

La integración incluye cuentas, preferencias, caché Notion, recordatorios, presencia, conversaciones, coordinación del robot, historial de checks y pendientes privados. Notion sigue siendo fuente de actividades. El robot necesita un programador externo; Realtime y offline todavía no están implementados.

1. Para un proyecto nuevo sin migraciones ANFETA, ejecuta una sola vez en SQL Editor `supabase/ANFETA_NEW_PROJECT.sql`, que reúne las ocho migraciones. No ejecutes luego las migraciones individuales otra vez. Si ya aplicaste algunas, ejecuta solamente las restantes en orden.
2. En Authentication desactiva registro público y crea las cuentas del equipo con correo y contraseña. No hay contraseñas predeterminadas.
3. En .env.local y en Vercel configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY. La clave secreta nunca debe tener prefijo NEXT_PUBLIC_.
4. Asigna cada usuario Auth a su perfil. Desde SQL Editor: INSERT INTO public.profiles (id,login_email,person_tag) VALUES ('UUID_DE_AUTH','CORREO_REAL','nneft'); Usa UUID/correo reales. Tags: jjohn, nneft, kkarl, iisai, ssote, aacal, aandr, bbria, ggena, eemma. También puedes usar scripts/supabase-profile.cjs con --env-file=.env.local; verifica que UUID y correo coincidan.
5. Reinicia la web. El selector de persona inicia sesión con la contraseña del correo asociado. El servidor verifica usuario y perfil activo en cada petición. Si hay configuración Supabase parcial falla con error; no vuelve al login anterior.
6. Prueba con dos cuentas: cada una ve sus búsquedas y favoritos; un perfil inactivo pierde acceso. Guarda en un dispositivo y abre el mismo usuario en otro.

Los datos existentes en Notion no se borran. La importación por cuenta se expone en POST /api/workspace con {importNotion:true}; requiere sesión de esa cuenta, solo funciona con revisión inicial 0 y no sobrescribe preferencias ya creadas. Favoritos antiguos de localStorage no se importan automáticamente porque ese almacén no identificaba al dueño.

Guardar preferencias usa una transacción y comprobación de revisión en PostgreSQL para evitar sobrescritura concurrente. Las tablas tienen RLS; las cuentas no pueden cambiar su tag ni crear perfiles. Favorites y saved_searches son vistas de lectura sobre user_preferences.

Sin claves Supabase se conserva el proveedor anterior. Con claves completas se utiliza Supabase y no se necesita ANFETA_SESSION_SECRET ni ANFETA_AUTH_USERS para el login. Los tokens Notion, Dropbox y VAPID conservan su configuración de servidor.

Aplicar la migración y crear perfiles es necesario además de añadir las claves. No se ha ejecutado en un proyecto remoto desde este trabajo.

## Verificación local

Ejecuta npm run test:supabase. La migración se prueba en PostgreSQL en memoria; las peticiones Auth/Notion se simulan. npm run build comprueba producción. Para confirmar Supabase remoto es necesario configurar el proyecto y probar con las cuentas reales; esta entrega no afirma esa prueba remota.

## Segunda fase: índice y agenda básica

Ejecuta después de la primera migración: supabase/migrations/202610060002_notion_cache.sql. Usa las mismas claves; no hay secretos adicionales.

Se crean notion_snapshots, notion_pages, activity_cache y sync_runs, con RLS por usuario. La clave de fuente depende del token Notion y de su fuente, para no mezclar integraciones.

El primer acceso al buscador muestra archivos locales/Dropbox disponibles mientras prepara la primera copia. Las páginas Notion del índice local no se muestran hasta confirmar el acceso con la integración actual. Luego se sirve la copia Supabase y se actualiza en segundo plano si supera 60 segundos. La agenda básica usa una copia por fecha con umbral de 30 segundos. Los checks y detalles enriquecidos siguen consultando Notion y respetan las reglas existentes.

El índice incremental se basa en la última edición observada en Notion, con solapamiento de dos minutos. Tras 24 horas se hace una lectura completa para reconciliar páginas que ya no aparecen; solo se limpia la copia, no se eliminan páginas de Notion. El botón Refrescar solicita lectura completa. Esta fase no incorpora todavía webhooks ni vigilancia con la web cerrada.

Los trabajos tienen lease por cuenta/fuente/consulta y quedan registrados en sync_runs. Una edición desde la web invalida las copias de esa fuente; una lectura que empezó antes de esa edición no puede sobrescribirlas. Al fallar se conserva la copia y se espera un minuto antes del reintento automático. Si hay cuentas distintas pueden tener sus propias sincronizaciones.

La actualización en segundo plano usa after de Next.js y depende del tiempo de ejecución permitido por el hosting. Una interrupción puede dejar la ejecución pendiente hasta que expire el lease y se vuelva a abrir/consultar la web. No es todavía un robot programado autónomo.

Validación real: abre con dos cuentas, observa origen/hora, cambia título/fecha, refresca, desconecta acceso Notion y comprueba aviso con copia conservada. Compara conteos con Notion; no se ha conectado a tu proyecto remoto durante este trabajo.

Con la web visible, el buscador consulta el estado cada minuto y al volver a la ventana. Durante una actualización pendiente hace comprobaciones breves para recoger la copia nueva, con límite de dos minutos; no consulta en segundo plano cuando la página está oculta.

El índice se entrega en páginas de hasta 500 resultados y aproximadamente 2 MB de contenido por página. Si cambia mientras se descarga, el cliente reinicia la lectura para mantener una sola versión. Las consultas periódicas envían la versión conocida: si no cambió el contenido, no descargan nuevamente toda la lista.

## Tercera fase: recordatorios persistentes

Ejecuta supabase/migrations/202610060003_reminders.sql después de la primera migración. Los recordatorios se guardan en Supabase, no como ejemplos ni en memoria del navegador. Creador y persona asignada pueden ver y completar; solo el creador elimina. Se rechazan cambios basados en una revisión antigua. Se consulta cada 30 segundos mientras la vista está visible y al volver a la ventana. No importa todavía los recordatorios del escritorio ni envía alarmas push por vencimiento.

## Otros pendientes completados en esta entrega

Avance diario permite descargar HTML o abrir impresión para guardar PDF, con el filtro de persona aplicado. La creación desde plantillas ahora copia texto, subtareas, títulos, desplegables, callouts, código y tablas. Conserva anotaciones y checks; excluye metadatos internos ANFETA. Valida hasta 300 bloques y 10 niveles antes de crear. Los tipos aún incompatibles (sincronizados, columnas, páginas/bases hijas y medios) producen un error visible en lugar de una copia incompleta. Si falla el pegado del cuerpo, intenta archivar solo la página recién creada y avisa si no puede hacerlo. No es todavía copia universal ni generación de preproyectos.

## Presencia del equipo

Ejecuta supabase/migrations/202610060004_presence.sql. La sesión verificada registra su propia actividad cada 45 segundos mientras la web está visible. El encabezado muestra las cuentas activas vistas durante los últimos dos minutos; pasa el cursor para ver los nombres. No significa que el equipo esté trabajando ni cambia roles o permisos. Sin Supabase no se simula presencia.

## Conversaciones generales y robot de servidor

Ejecuta las migraciones 5 y 6 después de la primera. Conversaciones añade hilos privados, mensajes de texto y estados por cuenta (lectura, atención, archivo). La actualización visible consulta cada 10 segundos; conserva los hilos Notion de revisión en otra pestaña. Los avisos PWA dependen de VAPID y suscripción previa. Adjuntos/audio todavía pendientes.

El robot comparte coordinación persistente entre navegador y servidor: serializa la fuente y día, evita repetir la corrida automática ya completada, continúa lotes pendientes y registra intentos por cuenta. Configura CRON_SECRET (32+ caracteres) y ANFETA_ROBOT_PERSON con un perfil activo. Un programador externo debe llamar GET /api/jobs/daily con Authorization: Bearer CRON_SECRET cada cinco minutos. El endpoint no actúa antes de las 05:00 de México y procesa un lote por llamada. Con varios lotes puede terminar después de las 05:00. El alojamiento debe permitir llamadas programadas y hasta 120 segundos por petición. No se ha activado ningún programador ni probado contra Notion real. No basta con agregar las claves: falta configurar el programador y desplegar.

## Subida unificada

El mismo modal recibe Ctrl+V, arrastrar archivos y el acceso Dropbox. Tres destinos, categorías del ProjectSuffixHelper original, vista DRX, título editable, persona, páginas separadas y nombres numerados. Solo Notion adjunta allí sin tocar Dropbox; el modo combinado guarda respaldo y referencias en Notion. La actividad temporal respeta permisos de asignación y avisa si no pudo crearse. El envío de archivos por esta interfaz se limita a 2.5 MB por lote para la petición JSON al servidor; archivos mayores requieren un flujo directo firmado que sigue pendiente. En un fallo parcial se muestran los pasos guardados y no se reenvía automáticamente.

## Historial verificable de checks

Ejecuta la séptima migración después de la primera y segunda. Cada cambio confirmado desde la web registra su fecha y actor; editar el texto conservando el check ya marcado no cambia esa fecha. Las observaciones antiguas no pisan un marcado reciente. Con Supabase, una tarea marcada externamente sin historial verificable conserva el total completado, pero no recibe crédito diario por su última edición. El avance y reporte indican estas fechas desconocidas. Sin Supabase se mantiene el modo anterior estimado, identificado como tal. La conciliación exacta con marcados antiguos del escritorio requiere instrumentar/importar ese historial; no se deduce de last_edited_time.

Los recordatorios pueden activarse como columna del calendario; mantienen tamaño común y no suman al checklist de las actividades.

## Octava migración: Pendientes privados
Aplica `202610060008_pending_preferences.sql` después de las migraciones anteriores. Pendientes de resultados se guarda ahora en las preferencias de la cuenta con revisión. La lista global antigua no se importa automáticamente porque no acredita a qué usuario pertenece. Los conflictos se muestran y recuperan la lista del servidor.

## Archivos de entorno y Git
`.env.example` se conserva únicamente como plantilla local, sin seguimiento de Git. Cópiala a `.env.local` para tus claves reales; `.gitignore` excluye todos los archivos `.env*`, incluida la plantilla. En producción configura las variables en el hosting. `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son públicos; `SUPABASE_SECRET_KEY`, tokens Notion/Dropbox, VAPID privada y `CRON_SECRET` son privados y nunca llevan `NEXT_PUBLIC_`. No subas archivos de entorno al repositorio.
