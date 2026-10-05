# ⚡ ANFETA v2.0 — Web & Multi-Monitor Workspace

Plataforma ejecutiva de productividad, búsqueda instantánea (*Everything-like*), gestión de actividades de Notion y timeline de calendario sincronizado bidireccionalmente.

---

## 🌟 Características Principales

1. **Buscador Instantáneo Everything-like:**
   - Indexación en memoria ultrarrápida (0ms de latencia de filtrado).
   - Coincidencias flexibles, por prefijo, comodines (`*`), etiquetas normalizadas y búsqueda compacta tolerante a espacios y símbolos.
   - Pestañas múltiples de búsqueda (`SearchTabs`) con guardado de accesos rápidos.
   - Tabla virtualizada de resultados con **columnas redimensionables interactivamente** y persistencia en `localStorage`.

2. **Panel de Detalles y Visor de Imágenes:**
   - Panel lateral redimensionable mediante splitter de arrastre (de 260px a 800px) con botón de expansión rápida (340px / 560px / 760px).
   - Bloques estructurados de Notion (tareas interactivas, encabezados, callouts, código copiable, citas y divisores).
   - **Visor Lightbox a pantalla completa** con zoom interactivo (0.25x – 8x) con la rueda del ratón o botones, paneo por arrastre, pantalla completa y descarga de imágenes.

3. **Timeline Canvas de Calendario (Paridad ANFETA WinUI):**
   - Lienzo visual por horas (8:00 AM – 21:00 / 22:00) con solapamiento dinámico de actividades.
   - Columnas por colaborador con selector de visibilidad (*People Picker*).
   - Controles de zoom porcentual, filtros de **💰 Cobros** y **💳 Pagos**.
   - Acceso a plantillas rápidas de Notion y robot de rezagadas de las 05:00 AM.

4. **Soporte Multi-Monitor y Ventana Independiente:**
   - Vista dedicada en `/calendar` para pantallas secundarias.
   - Sincronización bidireccional en tiempo real con el buscador principal mediante `BroadcastChannel` (`anfetaBroadcastSync`).

5. **Panel de Pendientes del Usuario:**
   - Tablero de notas y pendientes manuales con estados completados, prioridad y persistencia en disco y `localStorage`.

6. **PWA Instalable (Progressive Web App):**
   - Manifiesto configurado (`manifest.json`), iconos oficiales de ANFETA y funcionamiento standalone como aplicación de escritorio o móvil.

---

## 🚀 Inicio Rápido

### Requisitos previos
- Node.js 18.18.0 o superior
- npm, pnpm o yarn

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/anfeta-app.git
cd anfeta-app
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia el archivo de ejemplo y edita tus claves:
```bash
cp .env.example .env.local
```
O bien crea un `settings.json` en la raíz (ver `settings.example.json`):
```json
{
  "notionToken": "tu_token_de_notion",
  "dropboxPath": "C:\\Ruta\\A\\Tu\\Dropbox",
  "currentUser": "nneft",
  "isDryRun": true
}
```

### 4. Ejecutar en modo desarrollo
```bash
npm run dev
```
Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## 📦 Compilación para Producción

Para compilar la versión optimizada:
```bash
npm run build
npm start
```

---

## ☁️ Despliegue en Vercel

1. Sube tu proyecto a GitHub o GitLab.
2. Ingresa a [Vercel](https://vercel.com) e importa el repositorio `anfeta-app`.
3. Configura las variables de entorno en el panel de Vercel:
   - `NOTION_TOKEN`: Tu token secreto de integración de Notion.
4. Presiona **Deploy**. Vercel compilará la aplicación y te proporcionará una URL `https://tu-proyecto.vercel.app` segura con SSL.

---

## 📱 Instalación como PWA

- En **Google Chrome**, **Microsoft Edge** o **Brave**:
  1. Abre la URL en el navegador.
  2. Haz clic en el ícono de instalación en la barra de direcciones (**Instalar ANFETA**) o menú `⋯ > Aplicaciones > Instalar este sitio como aplicación`.
  3. Se creará un acceso directo en tu escritorio e iniciará en su propia ventana sin barra de navegación del navegador.

---

## 🛡️ Seguridad y Buenas Prácticas

- Los archivos `settings.json` y `.env*` están protegidos en `.gitignore` para no subir tokens personales ni rutas locales al repositorio público.
- Utiliza siempre `settings.example.json` y `.env.example` como plantilla base.

---

## 📄 Licencia

Desarrollado para el ecosistema de productividad y gestión de proyectos ANFETA.
