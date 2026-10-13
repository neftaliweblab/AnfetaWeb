# Revisión de acceso, sincronización y resultados — 12 de octubre de 2026

Las correcciones están en el código local. Las capturas prueban los síntomas, pero no permiten identificar por sí solas qué petición de producción devolvió cada 504. No se accedió a logs de Vercel ni a credenciales de producción y no se desplegó el código. Sí se encontró un token en la configuración local y se probó Notion en modo de solo lectura.

## Hallazgos y correcciones

| Síntoma | Fallo comprobado en el código | Corrección |
|---|---|---|
| Activando persona durante mucho tiempo | Se probaban contraseñas, cambio de contraseña, otro inicio de sesión y finalmente OTP; el acceso también recorría/creaba cuentas de todo el equipo. | Una sola verificación OTP para el perfil seleccionado. El acceso común no crea cuentas del equipo; solo se provisiona el perfil seleccionado si falta. La renovación de sesión tiene un límite de espera y los errores quedan visibles. |
| UUID / selección incorrecta | UUID inválido o ausente usaba un ID fijo; fallos al crear perfiles podían usar el UUID común. La selección podía guardarse aunque Supabase no confirmara la sesión. | UUID validado sin sustitución. Mensajes distintos para variable ausente, formato incorrecto y cuenta inexistente en Authentication. La sesión debe coincidir con el perfil activo antes de guardar la selección. |
| HTTP 504 / carga prolongada | Refrescar podía esperar una sincronización completa de Notion y reconstruir el catálogo antes de responder. Varias partes de la interfaz iniciaban lecturas duplicadas. | La petición entrega páginas del catálogo guardado; la actualización larga se ejecuta después de responder. Se eliminaron lecturas independientes del panel de resultados. Límites de espera de cliente y renovación de sesión; tiempos de respuesta en logs y Server-Timing. |
| Índice incompleto | Notion se cortaba a cinco páginas por base y a ocho segundos, pero podía registrar la lectura como completa. | Recorrido paginado completo con límite global de 90 segundos y cancelación. Si falla una base no se publica una copia incompleta como correcta. El error identifica la base y el data source. |
| Resultados faltantes al paginar | El cliente calculaba offsets fijos de 500 aunque el servidor puede recortar una página por tamaño en bytes. | Usa siempre nextOffset, comprueba la versión y conserva los resultados parciales hasta recibir una versión completa. |
| Catálogo listo con cero registros | Los mensajes consideraban una respuesta vacía o desconocida como catálogo listo/al día. | Estados separados: vacío, esperando, parcial, sincronizando y error. Un error no se presenta como actualización completada. |
| Isaías arriba / Neftalí abajo | El desplegable usaba tags y recibía nombres; además mezclaba filtro con cambio de identidad y podía guardar una preferencia antes de confirmar el cambio. | El desplegable es un filtro independiente, empieza en Todas las personas y normaliza nombres/tags. La persona activa y sus permisos siguen viniendo de la sesión verificada. |
| Tabla vacía con catálogo cargado | Filtros implícitos por persona y páginas de resultados fuera de rango podían ocultar filas. | Aviso explícito con cantidad cargada, botón para limpiar filtros y ajuste de la página cuando cambian el filtro o la cantidad de filas. |
| Caché incorrecta entre personas | La caché IndexedDB tenía una sola clave global. También había respaldo Supabase sin restringir la integración de origen. | Caché local por persona; la clave global anterior no se reutiliza. El respaldo del índice se limita a la misma fuente/integración. Las consultas de metadata no descargan todas las filas. |

## Notion: token, versión, permisos e IDs

- Los seis data source ID predeterminados se compararon con `App1/Services/Notion/NotionDataSources.cs` del Desktop. El ID de Revisiones puede ser reemplazado por la configuración del servidor; ese valor desplegado necesita comprobación real.
- Desktop usa Notion-Version `2026-03-11`, también indicado por la [documentación oficial de Notion](https://developers.notion.com/reference/create-view). La revisión no cambió esa versión.
- La interfaz añade **Diagnóstico Notion**: verifica el token con users/me y consulta una sola fila de cada base para comprobar acceso. Muestra origen del token, versión, tiempos, IDs y errores por base; permite descargar un JSON sin el token.
- Un token guardado en el navegador puede tener prioridad sobre el del servidor. El diagnóstico distingue navegador/servidor para localizar una configuración antigua.
- Validar el formato del ID no demuestra acceso. Un 404 puede corresponder a una base no compartida con la integración o a un ID incorrecto; el diagnóstico permite distinguirlo del catálogo vacío.

## Pruebas realizadas

### Conexión real de Notion desde la configuración local

- Integración: Asistente Anfeta Buscador. Token válido; seis bases accesibles y con registros. Diagnóstico: 2556 ms.
- Consulta completa: 4283 páginas activas únicas, 21042 ms. Cantidades antes de aplicar filtros de presentación: Revisiones 1945, Clientes 172, Dominios 254, Cobrar y pagar 1075, Programas y proyectos 74, Correos Contraseñas 763.
- Se confirma que, en esta lectura real, el límite anterior de ocho segundos era insuficiente. El corte de cinco páginas también omitía registros de Revisiones, Cobrar y pagar y Correos.
- No se escribieron páginas ni datos de Supabase. Solo se guardaron cantidades, tiempos y resultados del diagnóstico, sin token ni contenido de páginas.
- Esto valida la integración local, no las variables configuradas en Vercel. La configuración Supabase del servidor no estaba disponible en el entorno local de esta revisión; no se probó una sesión real de producción.

### Código y servicios simulados

- Compilación y TypeScript.
- Suite de regresión del proyecto, con servicios simulados y PostgreSQL en memoria.
- Paginación de Notion con ocho páginas en una base; fallo de acceso en otra base; resultado completo frente a parcial.
- Páginas de catálogo de tamaños variables sin saltos ni duplicados.
- Refresco solicitado responde con la copia disponible antes de ejecutar Notion; la copia se conserva ante fallos.
- Sesión compartida, perfiles activos/inactivos, OTP fallido sin selección provisional, UUID inválido/ausente y contraseñas verificadas por Supabase.
- Inicio de sesión que no responde: se rechaza a los ocho segundos sin guardar otra selección. La página vuelve a comprobar la sesión al recuperar foco/visibilidad y cada dos minutos mientras esté visible; no toma un error de conexión transitorio como una sesión confirmada.
- Catálogo vacío y errores sin estado de listo; caché separada por persona y fuente.

Estas pruebas no equivalen a una navegación completa con usuarios y servicios reales. No se prometen tiempos de producción a partir de mocks.

## Verificación pendiente después de publicar

1. En Vercel, confirmar que ANFETA_SHARED_AUTH_USER_ID sea el UUID de Authentication > Users en el mismo proyecto Supabase. La clave de acceso debe ser la contraseña de esa cuenta; no basta con escribirla en una variable de la web.
2. Publicar el código y probar acceso común, elección de Isaías, John y una persona normal, con sesión nueva y cambio de persona. Registrar los tiempos reales.
3. En Buscador, abrir Diagnóstico Notion y confirmar token y seis bases. Descargar el reporte si una base falla. No compartir tokens, contraseñas ni cookies.
4. Comprobar registros con Todas las personas, después con un filtro personal y búsqueda. Confirmar cantidades y navegación entre páginas.
5. Pulsar Sync Notion: debe conservar los registros mientras indica actualización en curso; verificar que llegue una copia nueva o un error específico.
6. Dejar la página inactiva varios minutos, volver, navegar y repetir con una sesión expirada. Confirmar que se renueve o pida acceso, sin activación indefinida.
7. Si vuelve un 504, registrar URL/tipo de petición, hora, código, Server-Timing si existe, logs de navegador `[ANFETA API client]` y de servidor `[ANFETA auth]`, `[ANFETA index]`, `[ANFETA index refresh]`. El logger del navegador conserva solo ruta conocida, tipo, offset y estado; no copia URL completa, token, cookies ni cuerpo. No se atribuye un 504 concreto a una causa sin esos datos.

Este bloque no añade SQL ni configura servicios externos. Si falta alguna migración existente, se debe aplicar únicamente la que corresponda al error identificado.
