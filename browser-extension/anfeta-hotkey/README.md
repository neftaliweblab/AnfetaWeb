# ANFETA Web: atajo global

Extensión Manifest V3 para Chrome, Edge y Brave en Windows. No modifica ANFETA Desktop.

## Instalación local

1. Abre `chrome://extensions`, `edge://extensions` o `brave://extensions`.
2. Activa **Modo de desarrollador** y selecciona **Cargar descomprimida**.
3. Selecciona esta carpeta, la que contiene `manifest.json`.
4. Abre la página de atajos del navegador y comprueba el alcance **Global**. La combinación sugerida es **Ctrl+Shift+8**; si no está asignada, elige una disponible.
5. Mantén el navegador ejecutándose y usa el mismo perfil de tu sesión ANFETA.

Desde otra aplicación, el atajo enfoca ANFETA. Si no encuentra una ventana, crea una ventana Web dedicada. Cuando esa ventana está al frente, el mismo atajo la minimiza; al pulsarlo otra vez, la restaura. No cierra ni termina ANFETA, de modo que conserva la sesión y el trabajo.

Las pestañas normales se enfocan sin minimizar ventanas compartidas con otros sitios. La detección de una PWA depende de que el navegador la exponga a las APIs de ventanas/pestañas; si no lo hace, la extensión abre una ventana Web dedicada. No puede arrancar un navegador completamente cerrado. La extensión debe cargarse manualmente en cada navegador/perfil; el despliegue de Vercel no la instala.

Permisos: almacenamiento local del identificador de ventana y último error, y acceso a la URL de ANFETA para localizar sus pestañas. No inyecta scripts ni lee datos de Notion/Dropbox.

## Verificación manual

- Probar desde otra aplicación, minimizar/restaurar y repetir sin duplicar ventanas.
- Probar con una pestaña normal, una PWA y la ventana dedicada.
- Cerrar la ventana dedicada y volver a abrirla con el atajo.
- Comprobar una combinación ocupada y corregirla en la configuración.
- Probar en Chrome, Edge y Brave. Las pruebas automatizadas usan APIs simuladas; no confirman el registro real de Windows.

Referencia: [Commands API y alcance global](https://developer.chrome.com/docs/extensions/reference/api/commands).
