# Acceso compartido ANFETA

Implementado en el código y autorizado por el usuario. Pendiente configurar y desplegar.

Configura en Vercel las variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY (solo servidor) y ANFETA_SHARED_AUTH_USER_ID=9e5e16dd-c844-49f6-9a72-9838e41d8b38. Usa la contraseña de ese usuario Auth para el acceso común. Ejecuta primero supabase/ANFETA_NEW_PROJECT.sql en el proyecto nuevo. No necesitas asignar un perfil a la cuenta común.

Después de ingresar se elige libremente la persona. John, Isaías y Genaro son revisores; los demás conservan las acciones sobre sus actividades y pueden enviarlas a revisión. Elegir un revisor concede ese rol, conforme a la selección libre autorizada.

El primer acceso correcto prepara los perfiles que falten con cuentas técnicas internas sin correos ni contraseñas adicionales para el equipo. Se reutilizan perfiles existentes; los inactivos permanecen inactivos. El servidor genera y verifica enlaces de sesión internamente; no los devuelve al navegador ni envía correos. Una cookie firmada limita el acceso compartido a ocho horas y vincula la persona al usuario Auth real para preservar las reglas RLS.

El selector también funciona en /calendar y el cambio recarga las demás pestañas abiertas. Sin ANFETA_SHARED_AUTH_USER_ID se conserva el acceso individual. No se ha conectado este entorno al proyecto remoto ni se han creado cuentas remotas durante el desarrollo.
