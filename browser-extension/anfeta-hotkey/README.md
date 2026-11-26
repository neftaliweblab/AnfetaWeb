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

## ZIP v1.1.1 y alcance del comando

Descarga de nuevo la versión 1.1.1 y extrae su contenido en una carpeta permanente. El paquete usa ZIP estándar, sin una entrada raíz ./ ni herramientas tar del sistema. Selecciona la carpeta extraída que contiene manifest.json. Si ya está instalada, reemplaza los archivos en su carpeta y pulsa Recargar en Extensiones.

Chrome informa la combinación registrada, pero no devuelve el alcance Global en commands.getAll(). Compruébalo en Atajos de extensiones. Ctrl+Shift+8 funciona desde otras aplicaciones solo con alcance Global y navegador ejecutándose; los atajos de búsquedas internas no reemplazan este comando.

## v1.1.2: carpeta permanente y alternativa nativa

Extrae el ZIP y ejecuta `Preparar-carpeta.ps1` desde PowerShell si la política de tu equipo lo permite. No requiere administrador, no cambia políticas ni instala la extensión: copia los seis archivos de ejecución/documentación a `%LOCALAPPDATA%/ANFETA/Extension`. Selecciona esa carpeta en Cargar descomprimida; para actualizar, vuelve a copiar y pulsa Recargar. No borres la carpeta permanente. Si ya tienes otra instalación, revisa sus atajos antes de quitarla.

Una desaparición no puede diagnosticarse solo desde la web. Comprueba carpeta, perfil, habilitación y políticas del navegador. El reposo del service worker es normal y no elimina la extensión. No hay código de autodesinstalación.

Sin extensión: instala la PWA desde el navegador y ancla ANFETA a la barra. Windows + número abre/cambia a la aplicación de esa posición. Windows + flecha abajo minimiza la ventana activa (desde maximizada puede requerir dos pulsaciones). No es un atajo global personalizado de la web.

## v1.1.3: múltiples orígenes, rutas y restauración de ventana maximizada

- Soporta tanto `https://anfeta-web.vercel.app/*` como `https://anfeta-web-iota.vercel.app/*` y cualquier ruta/parámetro (`/calendar`, `?q=...`).
- Limpia `managedWindowId` cuando se cierra una ventana y prioriza la ventana administrada o enfocada sin duplicar ventanas.
- Conserva el estado maximizado o pantalla completa al restaurar una ventana dedicada minimizada.
- Valida `customAppUrl` en opciones (solo `http:` / `https:`) y apunta el fallback predeterminado de sincronización de WhatsApp a producción (`https://anfeta-web.vercel.app/`).

## v1.1.6: inyección directa en MAIN world (`chrome.scripting`)

- Añade permiso `scripting` para ejecutar el cambio de módulo directamente en la pestaña activa aunque ya estuviera abierta antes de recargar la extensión, evitando bloqueos de `Isolated World` en Chrome/Brave/Edge.
- Soporte dual vía `window.postMessage` y fallback directo sobre los botones de módulos en la barra superior.

## v1.1.5: soporte nativo para Render (`anfeta-web.onrender.com`)

- URL predeterminada actualizada a `https://anfeta-web.onrender.com/` (compatible con `https://*.onrender.com/*`, además de orígenes previos de respaldo).
- Inyección automática del puente `anfeta-bridge.js` y permisos de host para Render.

## v1.1.4: cambio directo entre módulos desde la extensión

- Nuevo puente (`anfeta-bridge.js`) para cambiar de módulo directamente desde la extensión sin recargar la página.
- Comando `toggle-buscador-calendario` (**Ctrl+Shift+9**): enfoca ANFETA y alterna **Buscador ↔ Calendario**.
- Comando `next-module` (**Alt+Shift+M**): rota por **Buscador → Calendario → Avance Diario → Mensajes → Recordatorios**.
- Mantiene compatibilidad total con los atajos internos sin extensión (**Alt+1..5**, **Alt+Q**, **Alt+Shift+C**).
