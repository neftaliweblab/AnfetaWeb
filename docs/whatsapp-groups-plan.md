# Directorio de grupos de WhatsApp: propuesta

## Solicitud y evidencia

Revisión del 16 de octubre de 2026: transcripción WppAgrupacion.pdf y diez capturas distribuidas del video proporcionado. John solicita recuperar el acceso rápido a grupos que existía mediante la carpeta WhatsAppGroups, y estudiar una vinculación por QR para mantener sus nombres y accesos en ANFETA. En el video se observan accesos .url; todavía no se han inspeccionado sus contenidos ni comprobado que sus enlaces sigan funcionando.

Esta entrega implementa el orden de resultados; la conexión a WhatsApp queda como propuesta, sin sesiones ni cuentas conectadas.

## Primera fase recomendada: recuperar el directorio

- Importar los accesos .url existentes o un CSV; leer su campo URL como datos, sin ejecutar los archivos. Validar protocolos y destinos admitidos.
- Guardar nombre, ID cuando exista, proyecto/dominio, enlace verificado, estado comercial activo/inactivo y fecha de comprobación en Supabase.
- Evitar duplicados por ID; cambiar el nombre de un grupo no debe crear otro registro.
- Mostrar búsqueda, filtros, abrir grupo y copiar enlace desde ANFETA; permitir relacionarlo con una actividad o proyecto de Notion.
- Compartir solamente los grupos autorizados para cada usuario. Acceder a ANFETA no concede pertenencia al grupo de WhatsApp.
- Diferenciar un chat archivado de un proyecto inactivo: son estados diferentes.
- Un ID de grupo no constituye por sí mismo una URL universal. No construir enlaces wa.me con IDs de grupo. Si falta un acceso válido, mostrarlo como pendiente de vincular.
- Los enlaces de invitación pueden revocarse; permitir repararlos. No generar ni publicar nuevas invitaciones automáticamente.

## Segunda fase opcional: sincronización por QR

Es técnicamente viable con whatsapp-web.js: el propietario escanea el QR desde Dispositivos vinculados; cuando la sesión está lista, un servicio consulta los chats, filtra grupos y actualiza el directorio por ID. Después reconcilia cambios de nombre y pertenencia, y muestra estado conectado/desconectado y opción de desvincular.

Esto requiere un servicio Node.js con Chromium y persistencia de sesión, separado de las funciones de Vercel. ANFETA puede seguir en Vercel y comunicarse con ese servicio autenticado. No basta con dibujar un QR en el navegador. LocalAuth necesita almacenamiento persistente; una alternativa es RemoteAuth con un almacén compatible.

La librería utiliza funciones internas de WhatsApp Web y es una integración no oficial. Su proyecto advierte que no garantiza evitar bloqueos de cuenta. Conviene validar primero con un número de prueba y asumir mantenimiento cuando cambie WhatsApp Web.

El directorio solo necesita metadatos de grupos, no almacenar mensajes. Sin embargo, vincular un dispositivo concede acceso de sesión a la cuenta: el QR no limita los permisos a listar grupos. Credenciales y sesión deben permanecer protegidas en el servidor; el QR debe mostrarse únicamente al propietario autorizado. No guardar credenciales en Notion, archivos públicos ni localStorage.

La prueba inicial no enviaría mensajes, crearía grupos ni invitaría personas. Obtener un enlace de invitación depende de los permisos del usuario y no debe asumirse para todos los grupos.

## Alternativa oficial

Existe una Groups API para WhatsApp Business, pero su modelo y elegibilidad no equivalen a escanear el WhatsApp personal e importar todos sus grupos existentes. Antes de elegirla se debe confirmar la elegibilidad de la cuenta empresarial de John y la compatibilidad de los grupos que necesita. La documentación directa de Meta respondió con límite de solicitudes durante esta investigación; no se confirmó la elegibilidad de su cuenta.

## Criterios de aceptación del futuro directorio

1. Importar accesos no ejecuta archivos ni duplica grupos.
2. Un cambio de nombre conserva la relación con el proyecto.
3. Abrir utiliza un enlace real validado; los enlaces ausentes o revocados se identifican claramente.
4. La sesión y el QR no se exponen a otros integrantes.
5. Una desconexión conserva el directorio y permite reconectar sin duplicados.
6. Archivar un chat no marca automáticamente como inactivo al cliente.

## Orden de resultados implementado

En lista y cuadrícula, con y sin agrupación, los resultados activos preceden a los terminados. Dentro de cada grupo se aplica la misma regla; los grupos que contienen únicamente terminados pasan al final. Los grupos mixtos conservan su unidad. Dentro de cada categoría se conserva el orden secundario existente. La clasificación ocurre antes de paginar y respeta el estado oficial de la actividad.

## Fuentes técnicas

- [Autenticación y persistencia de whatsapp-web.js](https://wwebjs.dev/guide/creating-your-bot/authentication.html).
- [Cliente: consulta de chats y eventos](https://docs.wwebjs.dev/Client.html).
- [Grupos y códigos de invitación](https://docs.wwebjs.dev/GroupChat.html).
- [Proyecto y advertencia sobre integración no oficial](https://github.com/wwebjs/whatsapp-web.js).
- [Invitación a grupos: ayuda oficial de WhatsApp](https://faq.whatsapp.com/3242937609289432/?cms_platform=mac-desktop&helpref=platform_switcher).
- [Groups API: documentación del proveedor 360dialog](https://docs.360dialog.com/docs/messaging/groups).
- [Límites de funciones de Vercel](https://vercel.com/docs/functions/limitations).
