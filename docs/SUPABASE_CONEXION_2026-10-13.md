# Comprobación de la conexión Supabase

URL confirmada por el usuario: https://hidfygljzfothaktired.supabase.co. Se consultaron Authentication /auth/v1/health y Data API /rest/v1/ sin claves: respondieron HTTP401 en 318 y 132ms. Esto prueba DNS/conectividad desde el equipo de revisión; no valida las variables de Vercel ni las claves.

La configuración de Vercel no está disponible localmente: no existen .env/.env.local ni una sesión CLI autenticada. El fallo del login está antes de comprobar la contraseña, durante admin/users; también falla la comprobación de sesión. No se atribuye el problema a una caída general ni a contraseña incorrecta sin evidencia.

Cambios:
- Se valida que la URL sea la API de proyecto, sin ruta de dashboard, usuario/contraseña, query ni comillas.
- Se detectan tipos de clave invertidos y, en JWT antiguos, roles o referencia de proyecto incompatibles. No se imprime ninguna clave.
- La clave secreta se normaliza eliminando espacios exteriores.
- Los errores DNS/conexión/TLS y timeout se conservan como códigos seguros en la respuesta de acceso y en logs. El SDK había convertido la excepción de red en un mensaje que después se resumía genéricamente.
- GET /api/auth?connection=1 hace una lectura de salud con la clave publicable del servidor y devuelve host, healthStatus, publicKeyAccepted, duración y diagnóstico seguro. No verifica cuentas, no abre sesiones y no consulta datos personales. Usa exclusivamente la URL del entorno; la URL no se acepta del solicitante.

Después de publicar, abrir https://anfeta-web.vercel.app/api/auth?connection=1 en el mismo navegador:
- host diferente del confirmado: corregir NEXT_PUBLIC_SUPABASE_URL y desplegar de nuevo.
- código ENOTFOUND: revisar dominio configurado y DNS del despliegue.
- TIMEOUT/UND_ERR_CONNECT_TIMEOUT: conexión Vercel→Supabase lenta/no disponible; revisar disponibilidad del proyecto y región/logs.
- healthStatus 401/403: clave publicable rechazada por el proyecto; copiar la clave del mismo proyecto a Vercel.
- healthStatus 200: URL y clave publicable alcanzan Auth; diagnosticar entonces la consulta administrativa del login con la clave secreta. No implica que el UUID, la contraseña ni la clave secreta hayan sido validados.

El dominio transcrito inicialmente de una captura antigua contenía letras intercambiadas y no resolvía. Se descartó esa prueba en cuanto el usuario proporcionó la URL exacta; no se concluye que Vercel tenga ese error.

No se modificaron variables de Vercel, contraseñas, cuentas ni tablas de Supabase. No requiere SQL nuevo.
