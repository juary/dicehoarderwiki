# Dice Hoarder Wiki

An independent, English-language field guide for **Dice Hoarder** by DieCorp Games. Browse source-backed guides, game references, collectible leads, and update notes.

- GitHub Pages site: https://juary.github.io/dicehoarderwiki/
- Companion wiki: https://dicehoarder.site/
- Repository: https://github.com/juary/dicehoarderwiki
- Official game page: https://store.steampowered.com/app/3687090/Dice_Hoarder/

## Browse the wiki

The site includes a home page, category indexes, standalone article pages, browser-side search, a responsive layout, dark and light themes, a 404 page, and a generated sitemap. Article content and sources are kept in `src/data/content.json`; site labels and project details are in `src/data/site.json`.

The static pages are generated with Node.js and have no third-party dependencies or backend. Article content remains readable without client-side JavaScript. Search and theme controls use a small browser script.

## Run locally

Use Node.js 22 or later. No package installation is needed.

```sh
npm run build
npm run dev
```

Open the preview URL printed in the terminal. The local site uses the same `/dicehoarderwiki/` project path as GitHub Pages. To serve an existing build without rebuilding, run `npm run preview`.

## Project structure

```text
dicehoarderwiki/
├── .github/workflows/deploy.yml  # Build and publish to GitHub Pages
├── docs/
│   ├── DEPLOYMENT.md             # Setup and deployment notes
│   └── SOURCES.md                # Editorial scope, sources, and image credits
├── public/assets/                # Local game screenshots and favicon
├── scripts/
│   ├── build.mjs                 # Static page generator
│   └── serve.mjs                 # Local preview server
├── src/
│   ├── data/                     # Site settings and article content
│   ├── scripts/app.js            # Search and theme controls
│   └── styles/style.css          # Responsive site styles
└── package.json
```

## Automatic deployment

The workflow at `.github/workflows/deploy.yml` builds and publishes `dist/` when changes are pushed to `main`, or when manually started from GitHub Actions. For the first deployment, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. The site is published at https://juary.github.io/dicehoarderwiki/.

The full setup guide is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Content sources and limits are described in [docs/SOURCES.md](docs/SOURCES.md).

## Contributions

Use [GitHub Issues](https://github.com/juary/dicehoarderwiki/issues) to report errors or suggest topics. Include a source for gameplay corrections. Achievement conditions and patch behavior can change, so dated claims should be checked against the official Steam listing and developer announcements.

## Disclaimer

This is an unofficial fan project and is not affiliated with or endorsed by DieCorp Games. Dice Hoarder, its artwork, and related marks belong to their respective rights holders. See [docs/SOURCES.md](docs/SOURCES.md) for image and editorial notes.
