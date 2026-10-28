# alarcomu.github.io

Mi portfolio personal: [alarcomu.github.io](https://alarcomu.github.io)

Web estática generada con Node a partir de un JSON, desplegada en GitHub Pages con GitHub Actions. Incluye un panel en `/admin` para editar el contenido sin tocar código: los cambios se guardan como commits en este repositorio mediante la API de GitHub.

## Stack

- HTML, CSS y JavaScript sin frameworks
- Node.js (≥ 18) para el build, sin dependencias
- GitHub Actions + GitHub Pages
- API REST de GitHub para el panel de administración

## Desarrollo

```bash
npm run dev     # build + servidor en http://localhost:4321
npm run build   # genera dist/
```

## Estructura

```
content/content.json   datos de la web
scripts/build.mjs      generador del HTML, sitemap, robots y manifest
scripts/serve.mjs      servidor local
src/                   estilos y JS de la web
public/                estáticos y panel /admin
```

## Idiomas

La web se genera en español (`/`) y en inglés (`/en/`), con `hreflang` entre ambas versiones. Los textos en inglés están en la clave `en` de `content/content.json`, agrupados por id, y se editan desde la pestaña Inglés del panel. Lo que no esté traducido sale en español.

## Despliegue

Cada push a `main` lanza el workflow `.github/workflows/deploy.yml`, que genera `dist/` y lo publica en Pages.

## Panel de administración

Requiere un fine-grained token con acceso a este repositorio y permiso **Contents: Read and write**. El token se guarda solo en el navegador.
