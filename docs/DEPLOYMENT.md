# Deployment

## GitHub Pages

The `main` branch workflow in `.github/workflows/deploy.yml` builds the static site and publishes the `dist/` directory to GitHub Pages. It also supports a manual run from the Actions tab.

For the first deployment, open **Settings > Pages > Build and deployment** in the repository and select **GitHub Actions** as the source. The public project site is:

https://juary.github.io/dicehoarderwiki/

This is a project site hosted below `/dicehoarderwiki/`. The path is set in `src/data/site.json`; generated page links, assets, canonical URLs, search, and the sitemap use the same base path. No custom domain or CNAME is needed.

## Local preview

Use Node.js 22 or later. No third-party package installation is required.

```sh
npm run build
npm run dev
```

The preview server listens on port `4173` and serves the site below `/dicehoarderwiki/`. The generated files are in `dist/`, which is ignored by Git and recreated by the deployment workflow.

## Updating the site

Edit categories and article content in `src/data/content.json`. Update site identity, page labels, and links in `src/data/site.json`. Add local images under `public/assets/` and keep their source and rights holder in `docs/SOURCES.md`.

Push changes to `main` to publish. A failed build prevents the deployment job from running. Check the Actions run if the published site does not update.
