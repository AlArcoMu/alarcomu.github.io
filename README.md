# alarcomu.github.io

Portfolio personal de Alberto Arcones Muñoz con panel de administración, alojado gratis en GitHub Pages.

- **Web:** https://alarcomu.github.io
- **Admin:** https://alarcomu.github.io/admin/

## Cómo funciona

```
content/content.json  ──►  scripts/build.mjs  ──►  dist/ (HTML estático)  ──►  GitHub Pages
        ▲
        └── el panel /admin/ lo edita y hace commit con la API de GitHub
```

Todo el contenido vive en `content/content.json`. En cada push a `main`, GitHub Actions ejecuta el generador y publica HTML estático ya renderizado (sin JavaScript para mostrar el contenido), que es lo mejor para el SEO. El panel de admin edita ese JSON y sube las imágenes en un único commit; un minuto después la web está actualizada.

Si alguna vez el JSON quedara mal formado, la build falla y la web sigue mostrando la versión anterior.

## Puesta en marcha (una sola vez)

1. **Crea el repositorio** `alarcomu.github.io` en GitHub (público). El nombre tiene que ser exactamente ese para que la web quede en la raíz del dominio.
2. **Sube el código:**
   ```bash
   cd alarcomu.github.io
   git init -b main
   git add .
   git commit -m "Primera versión del portfolio"
   git remote add origin https://github.com/alarcomu/alarcomu.github.io.git
   git push -u origin main
   ```
3. **Activa Pages con Actions:** repositorio → *Settings* → *Pages* → *Build and deployment* → *Source*: **GitHub Actions**. Si el primer workflow falló por hacerlo antes de este paso, relánzalo desde la pestaña *Actions* (*Run workflow*).
4. **Crea el token del panel:** GitHub → *Settings* → *Developer settings* → *Personal access tokens* → **Fine-grained tokens** → *Generate new token*:
   - *Repository access*: **Only select repositories** → `alarcomu.github.io`
   - *Permissions* → *Repository permissions* → **Contents: Read and write**
   - Ponle caducidad (por ejemplo, 1 año).
5. Entra en **https://alarcomu.github.io/admin/**, pega el token y listo.

## Usar el panel

- **Proyectos, Experiencia y Estudios:** añadir, editar, reordenar con las flechas y eliminar.
- **Perfil:** nombre, presentación, foto, CV en PDF, contacto, habilidades e idiomas.
- **Ajustes y SEO:** título y descripción con contador y vista previa de Google, imagen para redes, orden de las secciones y dominio.
- Las imágenes se recortan y optimizan en el navegador (WebP) antes de subirlas.
- Los cambios se guardan como borrador en tu navegador hasta que pulsas **Publicar cambios** (o `Ctrl/Cmd + S`).
- Si editas el repositorio desde otro sitio mientras el panel está abierto, el panel lo detecta antes de sobrescribir nada.

**Seguridad:** el token nunca se guarda en el repositorio. Por defecto vive solo en la pestaña (sessionStorage); si marcas «Recordar» queda en ese navegador. El panel tiene una política CSP que solo permite conectar con `api.github.com`, y está excluido de Google (`noindex` y `robots.txt`). Sin un token válido, la página de admin no puede hacer nada.

## Trabajar en local

Requiere Node 18 o superior. Sin dependencias.

```bash
npm run dev        # genera dist/ y abre http://localhost:4321
npm run build      # solo genera dist/
```

El panel también funciona en local (`http://localhost:4321/admin/`), pero publica en GitHub de verdad.

## SEO incluido

- HTML semántico renderizado en el servidor de build, `lang="es"`, un solo `h1`, secciones con encabezados jerárquicos.
- Título, meta descripción, URL canónica, Open Graph (tipo `profile`) y Twitter Card con imagen 1200×630.
- Datos estructurados JSON-LD: `Person`, `ProfilePage`, `WebSite` e `ItemList` de proyectos.
- `sitemap.xml` con imágenes, `robots.txt`, `404.html`, manifest y favicons.
- Rendimiento: CSS y JS en línea, fuente propia (sin Google Fonts, mejor para el RGPD), imágenes con dimensiones y carga diferida.
- Accesible: enlace de salto, foco visible, contraste AA, respeta «reducir movimiento»; paleta negro, azul neón y magenta neón.

**Después de publicar:** da de alta la web en [Google Search Console](https://search.google.com/search-console) (propiedad de prefijo de URL `https://alarcomu.github.io/`) y envía `sitemap.xml`. Pon el enlace en tu perfil de LinkedIn y en el README de tu perfil de GitHub: los enlaces entrantes son lo que más ayuda a posicionar tu nombre.

## Dominio propio (opcional)

1. En el panel → *Ajustes y SEO*: pon el dominio en **Dominio propio** y cambia la **URL de la web** a `https://tudominio.com`.
2. En tu proveedor DNS, apunta el dominio a GitHub Pages (registros A a las IP de GitHub y `CNAME` de `www` a `alarcomu.github.io`).
3. En *Settings → Pages*, escribe el dominio y activa *Enforce HTTPS*.

## Estructura

```
content/content.json     contenido de la web (lo edita el panel)
src/styles.css           estilos (tokens de color, tipografía, layout)
src/main.js              tema claro/oscuro, menú móvil, sección activa
scripts/build.mjs        generador del HTML, SEO, sitemap y robots
scripts/serve.mjs        servidor local
public/                  se copia tal cual: fuentes, imágenes, CV, admin, uploads
public/admin/            panel de administración
.github/workflows/       build y despliegue en GitHub Pages
```
