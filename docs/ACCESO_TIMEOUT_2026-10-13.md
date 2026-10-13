# Diagnóstico de acceso lento

Las capturas muestran GET /api/auth con HTTP503 y un mensaje de timeout al verificar/renovar sesión. En incógnito también vence el POST de login: el fallo no está limitado a las cookies antiguas. Esto sitúa el problema en la ruta de autenticación, pero no demuestra una caída general de Supabase.

Riesgo comprobado en código: el cliente esperaba 28–30 segundos, /api/auth permitía 30 segundos y el cliente administrativo Supabase podía esperar 60. Además se acumulaban reintentos en navegador y servidor. El login empieza consultando la cuenta compartida en Supabase Authentication antes de comprobar la contraseña; una consulta lenta en ese paso impedía llegar al resultado de credenciales.

Correcciones locales:
- Presupuesto total de autenticación de 22 segundos y plazo por solicitud Supabase de 8 segundos durante /api/auth. Al agotarse, se abortan las solicitudes del mismo contexto; no se sustituyen por una sesión provisional.
- Se respetan señales de abortado de los consumidores. Los plazos de otras operaciones de datos permanecen separados.
- Logs [ANFETA auth transport] indican requestId, acción, etapa, duración y resultado. No contienen contraseñas, cookies, claves, UUID de cuenta ni URLs completas.
- El frontend ya no acumula otro reintento automático largo al verificar acceso. El botón de reintento sigue disponible. Se corrige el texto crudo Signal timed out.
- Se elimina el GET duplicado del formulario de login y se presenta el acceso compartido sin selector de colaborador hasta elegir persona dentro de la sesión. Se conserva el modo alternativo si el servidor lo informa explícitamente.
- Se corrigen referencias de listeners de foco y se cancela la consulta antigua al cambiar la sesión.

Sin sesión, Vercel respondió tres GET de acceso con HTTP200 y sharedMode=true en 418, 151 y 137ms. Esa medición no recorre la conexión de Authentication de Supabase. No hubo acceso a logs privados de Vercel/Supabase ni prueba con la contraseña real.

Publicar este código; no requiere SQL adicional. Si el fallo persiste, buscar [ANFETA auth transport] en Vercel: consultar cuenta compartida señala admin/users; iniciar o renovar sesión señala token; verificar sesión señala user; leer perfil señala profiles. Verificar entonces el proyecto Supabase, su URL, claves del mismo proyecto, disponibilidad y logs de Auth. No concluir contraseña incorrecta por un timeout.
