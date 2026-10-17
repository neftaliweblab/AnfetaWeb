# WAHA + WEBJS para ANFETA

## Qué incluye el código

Panel «Grupos de WhatsApp» encima del calendario, únicamente para John. La API aplica la misma restricción en el servidor. Permite conectar, mostrar un QR privado, importar grupos por lotes de 50, buscar, sugerir relaciones con las actividades del calendario cargado, confirmar/quitar relaciones y finalizar con logout y eliminación de la sesión. Los grupos, enlaces y relaciones permanecen en Supabase.

Solo se guardan nombres e IDs de grupos, fecha de importación, enlaces de acceso y relaciones confirmadas. No se importan mensajes, teléfonos de integrantes, fotos ni participantes. WAHA sigue siendo un dispositivo vinculado con acceso a la cuenta mientras está conectado: esto no equivale a un permiso de WhatsApp limitado a lectura.

Se consulta el enlace de invitación de un grupo solo cuando John pulsa «Obtener enlace». Depende de sus permisos. No se envían invitaciones, no se revocan códigos y no se crean grupos. También puede pegarse un enlace vigente manualmente. Un enlace de invitación concede acceso según las reglas del grupo: no es un acceso privado exclusivo de John. El ID del grupo no se transforma en una URL inventada.

## Preparación del servicio

1. Aplicar `supabase/migrations/202610160019_whatsapp_directory.sql` al proyecto de Supabase. No se ha aplicado a ninguna base remota desde esta entrega.
2. Preparar un servidor persistente con Docker, separado de Vercel. Utilizar una instancia dedicada a John: el nombre `default` permite utilizar la sesión única de WAHA Core. No reutilizar una sesión con bots u otras integraciones.
3. Usar `docs/whatsapp-waha.compose.yml` como base. Configurar `WAHA_IMAGE` con una versión o digest comprobado del proveedor. No se ha fijado una versión que no haya sido probada con una cuenta real. La disponibilidad de motores depende de la distribución elegida; verificar WEBJS en esa imagen.
4. Generar una clave aleatoria fuerte localmente. Guardar su hash SHA-512 como `WAHA_API_KEY_HASH=sha512:<hash>` en el entorno de Docker; la clave original se guarda solo como secreto de ANFETA. No subir ninguno de esos valores al repositorio.
5. Publicar el servicio mediante un proxy HTTPS autenticado por clave; el puerto del ejemplo solo escucha en localhost del servidor. Vercel necesita poder alcanzar esa URL HTTPS. Mantener dashboard y Swagger deshabilitados. No exponer Chrome ni su puerto de depuración.
6. Configurar en el servidor de ANFETA, sin prefijo `NEXT_PUBLIC_`:

```dotenv
WAHA_BASE_URL=https://waha.tu-dominio.example
WAHA_API_KEY=<clave original privada>
WAHA_SESSION=default
```

La URL no debe incluir `/api`: el conector lo agrega. Para pruebas locales se permite `http://localhost:3001`. Se usan las variables de Supabase ya existentes en ANFETA, incluida su clave privada de servidor. El servicio se comunica mediante API; no se agrega Puppeteer a las funciones de Vercel.

## Uso y validación real pendiente

1. Iniciar sesión en ANFETA como John y abrir Grupos de WhatsApp.
2. Probar primero en un entorno de pruebas con una base Supabase separada y una cuenta de WhatsApp de prueba. Conectar y escanear desde WhatsApp → Dispositivos vinculados. La primera cuenta fija la identidad del directorio de ese entorno; no usar un número de prueba en la base de producción de John.
3. Esperar estado Conectado. Importar y revisar el número de grupos disponibles. El total corresponde a los grupos disponibles para esa sesión de WAHA; comparar con WhatsApp antes de asumir cobertura completa.
4. Revisar nombres y buscar grupos conocidos, incluidos archivados. Una lista incompleta no debe asumirse completa simplemente porque terminó un lote. No confundir archivado del chat con inactividad del proyecto.
5. Seleccionar un grupo y obtener/guardar su enlace cuando sea posible. Confirmar sugerencias por dominio o título; buscar manualmente si no coincide. Las sugerencias solo usan actividades actualmente cargadas en el calendario, no todas las páginas de Notion.
6. Reimportar: no debe duplicar grupos ni perder relaciones o enlaces al cambiar el nombre. Los grupos ausentes de una importación posterior no se borran automáticamente: conservar su última fecha de importación.
7. Finalizar y desvincular. El conector exige logout antes de borrar la sesión y comprueba su ausencia; si falla muestra el error y no declara éxito. Confirmar también desde el teléfono que el dispositivo desapareció. Si la conexión falla, usar el teléfono para desvincularlo.
8. Reabrir el directorio con WAHA desconectado: los datos guardados y enlaces deben continuar disponibles. Los grupos nuevos o renombrados requerirán volver a vincular e importar.

Cerrar el panel no cierra la sesión: se indica expresamente. No se realiza importación periódica ni conexión automática. Si se abandona la página o se cierra el navegador durante la operación, revisar y cerrar el dispositivo desde el teléfono. Un siguiente intento de importación vuelve desde el principio y actualiza por ID los lotes ya guardados.

La primera cuenta importada fija la identidad del directorio. Se rechaza importar desde un número distinto para evitar mezclar cuentas. Cambiar el número requiere una migración deliberada del directorio; no hay botón de borrado masivo.

## Límites de esta entrega

Se verifican localmente el conector con respuestas simuladas, la importación SQL con Postgres embebido, TypeScript y compilación. No se ha desplegado WAHA, aplicado la migración remota ni escaneado una cuenta. El flujo real queda pendiente de configurar el servicio, migrar la base y hacer la prueba de extremo a extremo. El código no ofrece garantía contra bloqueos: usar Chrome o desvincular después no convierte la conexión en oficial.

Pruebas locales: `npm run test:whatsapp`. Incluyen respuestas WEBJS simuladas, paginación, validación de enlaces, coincidencias por título, logout fallido, importación SQL atómica, renombres sin perder relaciones, bloqueo de otra cuenta, permisos de tablas y autorización de la API. No sustituyen la prueba real del QR y de los enlaces en WhatsApp.

## Fuentes

- [Sesiones, QR, logout y eliminación](https://waha.devlike.pro/docs/how-to/sessions/).
- [Consulta paginada de grupos y enlaces](https://waha.devlike.pro/docs/how-to/groups/).
- [WEBJS y otros motores](https://waha.devlike.pro/docs/engines/).
- [Claves, HTTPS y seguridad del servicio](https://waha.devlike.pro/docs/how-to/security/).
- [Advertencia de WhatsApp sobre dispositivos no oficiales](https://faq.whatsapp.com/378279804439436/?cms_platform=android&locale=es_ES).
