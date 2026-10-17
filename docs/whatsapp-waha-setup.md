# WAHA + WEBJS: vista temporal para John y Neftalí

## Comportamiento actual

El panel Grupos de WhatsApp aparece encima del calendario para John y Neftalí. La API verifica ese permiso y selecciona la conexión a partir del usuario autenticado, nunca de un nombre enviado por el navegador.

Conectar → escanear QR → Obtener grupos → revisar nombres e IDs → Finalizar y desvincular.

Los grupos y enlaces obtenidos permanecen únicamente en la memoria de la ventana mientras el panel está abierto. Se borran al cerrar el panel, recargar, cambiar de persona o desmontar el calendario. Desvincular permite seguir revisando los resultados mientras el panel siga abierto. No se escriben en Supabase, Notion, archivos, localStorage ni almacenamiento de sesión del navegador. Las respuestas de la API llevan Cache-Control no-store.

Se retiraron las acciones de guardar enlaces y vincular actividades. La API rechaza también los antiguos comandos de persistencia, aunque se invoquen directamente. No consulta el directorio guardado anteriormente ni lo borra. La migración anterior de WhatsApp no es necesaria para esta vista temporal; la autenticación de ANFETA sigue usando su configuración habitual.

La consulta recorre lotes de 50 y comprueba el total. Si falla, muestra que los resultados son parciales. Solo devuelve nombres e IDs normalizados; no incorpora mensajes ni integrantes a la vista. Un enlace se consulta bajo demanda y se descarta al cerrar. Obtenerlo depende de los permisos del usuario en el grupo; no se envían invitaciones ni se revocan códigos.

## Configuración del servidor

John conserva estas variables privadas:

```dotenv
WAHA_BASE_URL=https://waha-john.tu-dominio.example
WAHA_API_KEY=<clave privada de John>
WAHA_SESSION=default
```

Neftalí usa variables propias, sin recurrir a las de John:

```dotenv
WAHA_NEFTALI_BASE_URL=https://waha-neftali.tu-dominio.example
WAHA_NEFTALI_API_KEY=<clave privada de Neftali>
WAHA_NEFTALI_SESSION=default
```

Las conexiones deben tener distinta instancia o distinta sesión. El conector rechaza la misma combinación URL/sesión para ambos usuarios. Con WAHA Core de sesión única, usar dos instancias separadas. Si se utiliza una distribución que permite varias sesiones, asignar nombres distintos y verificar que soporta WEBJS. Dos dominios que apunten al mismo servicio siguen requiriendo sesiones distintas: los alias de infraestructura deben revisarse durante el despliegue.

No usar prefijos NEXT_PUBLIC_ para las claves. No incluir /api en la URL. Se permite HTTP solo en localhost para pruebas. Configurar HTTPS para conexiones remotas.

El archivo whatsapp-waha.compose.yml sirve como base para cada instancia. Configurar una imagen WAHA comprobada con WEBJS mediante WAHA_IMAGE y el hash privado de su clave mediante WAHA_API_KEY_HASH. Para ejecutar ambas instancias en el mismo servidor, usar nombres de proyecto Compose distintos, volúmenes separados y otro puerto local para la segunda (por ejemplo 3002). Proteger el servicio con API key y proxy HTTPS. No exponer Chrome ni su puerto de depuración.

## Sesión de WhatsApp y retención

Aunque los resultados no se guarden en ANFETA, WAHA necesita mantener su sesión de autenticación durante la conexión; puede utilizar el volumen de sesiones del servicio. Este estado es distinto del listado de grupos y desaparece mediante logout y eliminación de sesión al pulsar Finalizar y desvincular. No se promete ausencia total de datos internos en WhatsApp Web mientras esté conectado.

Cerrar el panel borra los resultados pero no desvincula el dispositivo. Si se abandona la página o falla la desconexión, revisar Dispositivos vinculados en el teléfono y cerrar la sesión allí. La integración no es oficial y no garantiza evitar restricciones de cuenta.

## Verificación

Pruebas locales: npm run test:whatsapp. Comprueban la consulta paginada, los campos devueltos, enlaces, logout, acceso de John y Neftalí, rechazo de otros usuarios, separación de conexiones y ausencia de llamadas de almacenamiento desde la API temporal. También conservan cobertura de la migración histórica, que no se utiliza en este flujo.

Falta configurar las instancias WAHA y probar el QR con cuentas reales. La compilación y las pruebas simuladas no sustituyen esa verificación. No se ha desplegado ni conectado ninguna cuenta desde esta entrega.

## Fuentes

- [Sesiones, QR, logout y eliminación](https://waha.devlike.pro/docs/how-to/sessions/).
- [Consulta paginada de grupos y enlaces](https://waha.devlike.pro/docs/how-to/groups/).
- [Motores](https://waha.devlike.pro/docs/engines/).
- [Seguridad del servicio](https://waha.devlike.pro/docs/how-to/security/).
