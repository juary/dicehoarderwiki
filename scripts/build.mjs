import { readFile, writeFile, mkdir, cp, rm, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const site = JSON.parse(
  await readFile(resolve(root, "src/data/site.json"), "utf8"),
);
const { categories, articles } = JSON.parse(
  await readFile(resolve(root, "src/data/content.json"), "utf8"),
);
const siteURL = new URL(process.env.SITE_URL || site.url);
if (!["http:", "https:"].includes(siteURL.protocol))
  throw new Error("SITE_URL must use http or https");
const base = siteURL.pathname.replace(/\/$/, "") + "/";
siteURL.pathname = base;
const href = (path = "") => base + path.replace(/^\//, "");
const absolute = (path = "") => new URL(href(path), siteURL.origin).href;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const inline = (value) => {
  const text = String(value ?? "");
  const pattern = /\[([^\]]+)\]\((\/[a-z0-9/-]+\/?)(#[a-z0-9-]+)?\)/g;
  let html = "";
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    html += esc(text.slice(cursor, index));
    html += `<a href="${href(match[2].slice(1))}${match[3] || ""}">${esc(match[1])}</a>`;
    cursor = index + match[0].length;
  }
  return html + esc(text.slice(cursor));
};
const articlePath = (article) => `${article.category}/${article.slug}/`;
const bySlug = (slug) => articles.find((article) => article.slug === slug);
const categoryOf = (id) => categories.find((category) => category.id === id);
const date = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
const readingTime = (article) =>
  typeof article.readTime === "number"
    ? `${article.readTime} min read`
    : article.readTime || "4 min read";
const icons = {
  dice: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><circle cx="9" cy="8" r=".8"/><circle cx="15" cy="16" r=".8"/><circle cx="12" cy="12" r=".8"/>',
  guides:
    '<path d="M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-3H4V3ZM20 3h-4a3 3 0 0 0-3 3v15a4 4 0 0 1 4-3h3V3Z"/>',
  wiki: '<path d="M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4Zm16 0h-2a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h2V4Z"/>',
  collectibles:
    '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  updates: '<path d="M4 7h13l-4-4M20 17H7l4 4M20 7v5M4 17v-5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M14 3h7v7m0-7L10 14"/><path d="M10 3H4v17h17v-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.dice}</svg>`;
const external = (url, label, cls = "") =>
  `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}${icon("external")}</a>`;

const slugs = new Set();
const publicPaths = new Set([
  ...categories.map((category) => `/${category.id}/`),
  ...articles.map((article) => `/${article.category}/${article.slug}/`),
]);
for (const article of articles) {
  if (!categoryOf(article.category))
    throw new Error(`Unknown category for ${article.slug}`);
  if (!/^[a-z0-9-]+$/.test(article.slug) || slugs.has(article.slug))
    throw new Error(`Invalid or duplicate slug: ${article.slug}`);
  slugs.add(article.slug);
  const ids = new Set([
    "main",
    "article-sources",
    "search-dialog",
    "search-title",
    "search-input",
    "search-status",
    "search-results",
  ]);
  for (const section of article.sections) {
    if (!/^[a-z0-9-]+$/.test(section.id) || ids.has(section.id))
      throw new Error(`Invalid section: ${article.slug}/${section.id}`);
    ids.add(section.id);
  }
  if (!article.sources?.length)
    throw new Error(`Sources missing for ${article.slug}`);
  for (const related of article.related || [])
    if (!bySlug(related))
      throw new Error(`Missing related article: ${article.slug} -> ${related}`);
  for (const section of article.sections) {
    for (const paragraph of [
      ...(section.paragraphs || []),
      ...(section.bullets || []),
    ]) {
      for (const match of paragraph.matchAll(
        /\[[^\]]+\]\((\/[a-z0-9/-]+\/?)(?:#[a-z0-9-]+)?\)/g,
      ))
        if (!publicPaths.has(match[1]))
          throw new Error(`Unknown internal link in ${article.slug}: ${match[1]}`);
    }
  }
  await stat(resolve(root, "public/assets", article.image));
}
for (const category of categories)
  if (!articles.some((article) => article.category === category.id))
    throw new Error(`Category has no articles: ${category.id}`);

const logo = `<span class="logo-mark">${icon("dice")}</span><span class="wordmark">${esc(site.shortName)}<span>WIKI & FIELD GUIDE</span></span>`;
const navLinks = (active) =>
  `<a href="${href()}" ${active === "" ? 'aria-current="page"' : ""}>${site.ui.home}</a>${categories.map((category) => `<a href="${href(category.id + "/")}" ${active === category.id ? 'aria-current="page"' : ""}>${esc(category.title)}</a>`).join("")}<a href="${href("about/")}" ${active === "about" ? 'aria-current="page"' : ""}>${site.ui.about}</a>`;
const header = (active) =>
  `<a href="#main" class="skip-link">${site.ui.skip}</a><header class="site-header"><div class="container header-inner"><a class="logo" href="${href()}" aria-label="${esc(site.name)} home">${logo}</a><nav class="desktop-nav" aria-label="Main navigation">${navLinks(active)}</nav><div class="header-tools"><button class="search-trigger icon-button" data-open-search aria-label="${site.ui.search}">${icon("search")}<span>Search</span></button><button class="icon-button theme-toggle" aria-label="${site.ui.theme}" title="${site.ui.theme}">${icon("sun")}</button><details class="mobile-menu"><summary aria-label="Open navigation">${site.ui.menu}</summary><nav aria-label="Mobile navigation">${navLinks(active)}</nav></details></div></div></header>`;
const footer = `<footer class="site-footer"><div class="container footer-grid"><div><a class="logo" href="${href()}">${logo}</a><p>A little order.<br>A lot of dice.</p></div><div><h2>Explore the wiki</h2>${categories.map((category) => `<a href="${href(category.id + "/")}">${esc(category.title)}</a>`).join("")}</div><div><h2>Game and project</h2>${external(site.steam, "Dice Hoarder on Steam")}${external(site.repository, "Source on GitHub")}<a href="${href("about/")}">About this project</a></div><div class="footer-related"><h2>More to explore</h2><p>Visit the companion wiki for more guides and references.</p>${external(site.relatedSite, "dicehoarder.site", "text-link")}</div></div><div class="container footer-bottom"><p>${site.ui.footerNotice}</p><span>© ${new Date(site.reviewed).getUTCFullYear()} ${esc(site.maintainer)} · ${site.ui.footerCredit}</span></div></footer>`;
const dialog = `<dialog id="search-dialog" class="search-dialog" aria-labelledby="search-title"><div class="search-heading"><h2 id="search-title">${site.ui.search}</h2><button class="icon-button" data-close-search aria-label="${site.ui.close}">${icon("close")}</button></div><label class="search-field">${icon("search")}<span class="sr-only">${site.ui.search}</span><input id="search-input" type="search" autocomplete="off" placeholder="${esc(site.ui.searchPlaceholder)}"></label><p id="search-status" aria-live="polite">${site.ui.searchHint}</p><div id="search-results"></div></dialog>`;
const themeInit = `try{const t=localStorage.getItem('dicehoarder-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`;

function page({
  title,
  description = site.description,
  path = "",
  active = "",
  body,
  type = "WebPage",
  article,
  noindex = false,
}) {
  const url = absolute(path);
  const jsonld = {
    "@context": "https://schema.org",
    "@type": type,
    name: title,
    description,
    url,
    inLanguage: "en",
    ...(article
      ? {
          headline: title,
          dateModified: article.updated,
          author: { "@type": "Person", name: site.maintainer },
        }
      : {}),
  };
  const shareImage = absolute("assets/header.webp");
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}${path ? ` | ${esc(site.name)}` : ""}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="${esc(site.themeColor)}"><meta name="color-scheme" content="dark light">${noindex ? '<meta name="robots" content="noindex, follow">' : ""}<link rel="canonical" href="${url}"><link rel="icon" type="image/svg+xml" href="${href("assets/favicon.svg")}"><meta property="og:type" content="${article ? "article" : "website"}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:image" content="${shareImage}"><meta property="og:image:width" content="1600"><meta property="og:image:height" content="900"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${shareImage}"><script>${themeInit}</script><link rel="stylesheet" href="${href("assets/style.css")}"><script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script><script type="module" src="${href("assets/app.js")}"></script></head><body data-base="${base}">${header(active)}${body}${footer}${dialog}</body></html>`;
}
const breadcrumb = (title, category) =>
  `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${href()}">Home</a>${icon("chevron")}${category ? `<a href="${href(category.id + "/")}">${esc(category.title)}</a>${icon("chevron")}` : ""}<span aria-current="page">${esc(title)}</span></nav>`;
function card(article, index = 0) {
  return `<a class="article-card" href="${href(articlePath(article))}"><div class="card-top"><span class="eyebrow">${esc(categoryOf(article.category).title)}</span><span class="card-index">${String(index + 1).padStart(2, "0")}</span></div><h3>${esc(article.title)}</h3><p>${esc(article.description)}</p><span class="card-bottom">${esc(readingTime(article))}${icon("arrow")}</span></a>`;
}
const sectionTitle = (small, title, url, label = "Explore all") =>
  `<div class="section-heading"><div><span class="eyebrow">${small}</span><h2>${title}</h2></div>${url ? `<a class="text-link" href="${url}">${label}${icon("arrow")}</a>` : ""}</div>`;

function home() {
  const beginner = bySlug("beginner-guide");
  const starters = ["dice-sets", "game-modes", "launch"]
    .map(bySlug)
    .filter(Boolean);
  const quickLinks = [
    "sorting-dice",
    "achievement-guide",
    "floppy-disk-locations",
    "edible-dice",
  ]
    .map(bySlug)
    .filter(Boolean);
  const body = `<main id="main"><section class="hero"><div class="hero-art"><img src="${href("assets/shop.webp")}" alt="Dice Hoarder shop with wooden sorting trays and colorful dice" width="1600" height="900" fetchpriority="high"></div><div class="container hero-inner"><div class="hero-copy"><span class="eyebrow hero-eyebrow"><span class="live-dot"></span> THE DICE HOARDER FIELD GUIDE</span><h1>Dice Hoarder<br><em>Wiki &amp; Guides</em></h1><p>A little order for a whole lot of dice. Find your way around the shop, build your collection, and explore the game's systems at your own pace.</p><div class="hero-actions"><a class="button primary" href="${href(articlePath(beginner))}">Start your first shift${icon("arrow")}</a><a class="button secondary" href="#explore">Explore the wiki</a></div><div class="hero-note">${icon("dice")}Independent fan wiki · ${esc(site.developer)}'s Dice Hoarder</div></div><div class="art-caption"><span>THE DICE SHOP</span>One set at a time.</div></div></section><div class="facts-strip"><div class="container"><span>${icon("check")} Source-led guides</span><span>${icon("dice")} ${articles.length} pages to explore</span><span>${icon("guides")} English edition</span>${external(site.steam, "Find the game on Steam")}</div></div><div class="container home-layout"><div class="home-main"><section class="getting-started">${sectionTitle("YOUR FIRST STEPS", "Learn the rhythm of the shop.", href("guides/"), "All guides")}<div class="start-grid"><a class="featured-guide" href="${href(articlePath(beginner))}"><img src="${href("assets/shop.webp")}" alt="Wooden dice trays and scattered dice inside the shop" width="1600" height="900" loading="lazy"><div class="featured-copy"><span class="eyebrow">START HERE</span><h3>Your first shift</h3><p>Learn the seven-piece set and build a calm sorting routine.</p><span class="text-link">Read the guide${icon("arrow")}</span></div></a><div class="starter-list">${starters.map((article) => `<a href="${href(articlePath(article))}"><span class="mini-icon">${icon(article.category)}</span><div><span class="eyebrow">${esc(categoryOf(article.category).title)}</span><h3>${esc(article.title)}</h3><p>${esc(article.description)}</p></div>${icon("arrow")}</a>`).join("")}</div></div></section><section id="explore" class="explore-section">${sectionTitle("FOLLOW YOUR CURIOSITY", "Browse the game wiki.")}<div class="category-grid">${categories.map((category, index) => `<a class="category-card" href="${href(category.id + "/")}"><span class="category-icon">${icon(category.icon)}</span><span class="category-number">0${index + 1}</span><h3>${esc(category.title)}</h3><p>${esc(category.description)}</p><span class="text-link">${articles.filter((article) => article.category === category.id).length} pages${icon("arrow")}</span></a>`).join("")}</div></section><section class="latest-section">${sectionTitle("FROM THE DEVELOPER", "Release and patch notes.", href("updates/"), "All updates")}<div class="article-grid two">${articles.filter((article) => article.category === "updates").map(card).join("")}</div></section></div><aside class="home-aside"><section class="dossier"><div class="dossier-title">${icon("dice")}<span>THE GAME AT A GLANCE</span></div><h2>${esc(site.shortName)}</h2><p>A cozy first-person dice-organizing game set in a mysterious shop.</p><dl><div><dt>Developer</dt><dd>${esc(site.developer)}</dd></div><div><dt>Genre</dt><dd>${esc(site.game.genre)}</dd></div><div><dt>Platform</dt><dd>${esc(site.game.platform)}</dd></div><div><dt>Released</dt><dd>${esc(site.game.releaseDate)}</dd></div><div><dt>Play style</dt><dd>${esc(site.game.players)}</dd></div></dl>${external(site.steam, "View on Steam", "button secondary full")}</section><section class="quick-links"><h2>A few good places to start</h2>${quickLinks.map((article) => `<a href="${href(articlePath(article))}">${esc(article.title)}${icon("chevron")}</a>`).join("")}</section><section class="companion"><span class="eyebrow">THE COMPANION WIKI</span><h2>Keep exploring.</h2><p>Visit the companion site for more guides and references.</p>${external(site.relatedSite, "dicehoarder.site", "text-link")}</section><p class="editorial-note">Articles cite official announcements and clearly labeled community reports. Source review: ${date(site.reviewed)}.</p></aside></div><section class="bottom-banner"><div class="container"><div><span class="eyebrow">A FAN GUIDE BUILT IN THE OPEN</span><h2>Help keep the details clear.</h2><p>Found a correction or a new source? Share it with the project.</p></div>${external(site.repository + "/issues", "Contribute on GitHub", "button secondary")}</div></section></main>`;
  return page({ title: "Dice Hoarder Wiki and Guides", body });
}

function categoryPage(category) {
  const entries = articles.filter((article) => article.category === category.id);
  return page({
    title: `${category.title} — Dice Hoarder Wiki`,
    description: category.description,
    path: category.id + "/",
    active: category.id,
    body: `<main id="main" class="container page-main">${breadcrumb(category.title)}<header class="page-heading"><span class="eyebrow">${icon(category.icon)} THE FIELD GUIDE / ${entries.length} PAGES</span><h1>${esc(category.title)}</h1><p>${esc(category.description)}</p></header><div class="article-grid">${entries.map(card).join("")}</div><div class="category-bottom"><p>New to the shop?</p><a class="text-link" href="${href("guides/beginner-guide/")}">Begin with the first-shift guide${icon("arrow")}</a></div></main>`,
  });
}

function articlePage(article) {
  const category = categoryOf(article.category);
  const toc = article.sections
    .map((section) => `<a href="#${esc(section.id)}">${esc(section.title)}</a>`)
    .join("");
  const sections = article.sections
    .map(
      (section) =>
        `<section id="${esc(section.id)}"><h2>${esc(section.title)}</h2>${(section.paragraphs || []).map((paragraph) => `<p>${inline(paragraph)}</p>`).join("")}${section.bullets ? `<ul>${section.bullets.map((bullet) => `<li>${inline(bullet)}</li>`).join("")}</ul>` : ""}${section.table ? `<div class="table-scroll"><table><thead><tr>${section.table.headers.map((heading) => `<th scope="col">${esc(heading)}</th>`).join("")}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}</section>`,
    )
    .join("");
  const related = (article.related || [])
    .slice(0, 2)
    .map(bySlug)
    .filter(Boolean);
  const body = `<main id="main" class="container page-main article-page">${breadcrumb(article.title, category)}<div class="article-layout"><article><header class="article-heading"><a class="eyebrow" href="${href(category.id + "/")}">${esc(category.title)} / FIELD NOTES</a><h1>${esc(article.title)}</h1><p class="article-intro">${esc(article.description)}</p><div class="article-meta"><span>By ${esc(site.maintainer)}</span><span>Reviewed ${date(article.updated)}</span><span>${esc(readingTime(article))}</span></div></header><figure class="article-visual"><img src="${href("assets/" + article.image)}" alt="${esc(article.imageAlt)}" width="1600" height="900"><figcaption>Game screenshot © ${esc(site.developer)}. See the source notes for image credits.</figcaption></figure><details class="mobile-toc"><summary>${site.ui.onThisPage}</summary><nav aria-label="Article sections">${toc}</nav></details><div class="prose">${sections}<section id="article-sources" class="source-section"><span class="eyebrow">CHECK THE SOURCES</span><h2>${site.ui.sources}</h2><ul>${article.sources.map((source) => `<li>${external(source.url, esc(source.title))}</li>`).join("")}</ul><p class="source-disclaimer">This independent reference summarizes published sources. Source review does not imply hands-on gameplay testing. Game updates may change behavior.</p></section></div><section class="related-section">${sectionTitle("NEXT IN THE FIELD GUIDE", site.ui.related)}<div class="article-grid two">${related.map(card).join("")}</div></section></article><aside class="article-aside"><div class="toc"><span class="eyebrow">${site.ui.onThisPage}</span><nav aria-label="Table of contents">${toc}<a href="#article-sources">Sources and further reading</a></nav><a class="back-top" href="#main">↑ ${site.ui.backToTop}</a></div><section class="companion"><span class="eyebrow">THE COMPANION WIKI</span><h2>More to discover.</h2><p>Find additional Dice Hoarder guides and references.</p>${external(site.relatedSite, "dicehoarder.site", "text-link")}</section></aside></div></main>`;
  return page({
    title: article.title,
    description: article.description,
    path: articlePath(article),
    active: article.category,
    body,
    type: "Article",
    article,
  });
}

function aboutPage() {
  return page({
    title: "About this project",
    description:
      "About Dice Hoarder Wiki, an independent English fan guide hosted on GitHub Pages, with the companion site dicehoarder.site.",
    path: "about/",
    active: "about",
    body: `<main id="main" class="container page-main">${breadcrumb("About")}<header class="page-heading"><span class="eyebrow">A NOTE ABOUT THIS PROJECT</span><h1>A guide to the dice shop.</h1><p>Dice Hoarder Wiki is an independent fan project by ${esc(site.maintainer)}, made to help players find clear, source-backed information.</p></header><div class="about-layout"><div class="prose"><section><h2>What is this wiki?</h2><p>This project covers Dice Hoarder, the first-person organizing game developed and published by DieCorp Games. It brings beginner advice, game references, collectible search leads, published achievement requirements, and dated patch summaries into one static website.</p><p>The GitHub Pages site and ${external(site.relatedSite, "the companion website")} are separate fan resources. Neither is an official developer site.</p></section><section><h2>How we handle sources</h2><p>We prioritize the official Steam store, achievement descriptions, and developer announcements. Each article links its sources and shows the date its material was reviewed. Community disk names and edible-dice locations are labeled as player reports rather than official facts.</p><p>Editorial suggestions are not presented as tested fastest routes. Patch summaries keep the version visible so older behavior is not mistaken for a current guarantee.</p>${external(site.repository + "/blob/main/docs/SOURCES.md", "Read the source and editorial notes", "text-link")}</section><section><h2>Artwork and independence</h2><p>Game screenshots and related marks belong to DieCorp Games and their respective rights holders. They are used here to identify and discuss the game. This project is not affiliated with or endorsed by DieCorp Games or Valve.</p><p>Current availability, pricing, and system requirements can change; check the live Steam listing before purchasing.</p></section><section><h2>Corrections and contributions</h2><p>If a detail has changed or a source is missing, open an issue with the article URL and supporting evidence. Contributions that make the guide more accurate and useful are welcome.</p>${external(site.repository, "Browse the project on GitHub", "button secondary")}</section></div><aside class="about-aside"><section class="dossier"><div class="dossier-title">${icon("dice")}<span>PROJECT DETAILS</span></div><dl><div><dt>Project</dt><dd>dicehoarderwiki</dd></div><div><dt>Maintainer</dt><dd>${esc(site.maintainer)}</dd></div><div><dt>Language</dt><dd>English</dd></div><div><dt>Hosting</dt><dd>GitHub Pages</dd></div><div><dt>Companion</dt><dd>dicehoarder.site</dd></div></dl>${external(site.repository, "Source on GitHub", "text-link")}</section></aside></div></main>`,
  });
}

if (output !== resolve(root, "dist") || dirname(output) !== root)
  throw new Error("Unexpected output directory");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "public"), output, { recursive: true });
await cp(
  resolve(root, "src/styles/style.css"),
  resolve(output, "assets/style.css"),
);
await cp(resolve(root, "src/scripts/app.js"), resolve(output, "assets/app.js"));
const writePage = async (path, html) => {
  const file = resolve(output, path, "index.html");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
};
await writePage("", home());
for (const category of categories)
  await writePage(category.id, categoryPage(category));
for (const article of articles)
  await writePage(articlePath(article), articlePage(article));
await writePage("about", aboutPage());
await writeFile(
  resolve(output, "404.html"),
  page({
    title: "Page not found",
    path: "404.html",
    noindex: true,
    body: `<main id="main" class="container not-found"><span class="eyebrow">FIELD NOTE / 404</span><h1>That path is missing.</h1><p>This page may have moved. There is still plenty to explore in the guide.</p><a class="button primary" href="${href()}">Back to the wiki${icon("arrow")}</a></main>`,
  }),
);
await writeFile(
  resolve(output, "search-index.json"),
  JSON.stringify({
    ui: site.ui,
    articles: articles.map((article) => ({
      title: article.title,
      description: article.description,
      category: categoryOf(article.category).title,
      url: href(articlePath(article)),
      text: article.sections
        .flatMap((section) => [
          section.title,
          ...(section.paragraphs || []),
          ...(section.bullets || []),
          ...(section.table?.rows.flat() || []),
        ])
        .join(" "),
    })),
  }),
);
const paths = [
  "",
  "about/",
  ...categories.map((category) => category.id + "/"),
  ...articles.map(articlePath),
];
await writeFile(
  resolve(output, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${esc(absolute(path))}</loc></url>`).join("")}</urlset>`,
);
await writeFile(
  resolve(output, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${absolute("sitemap.xml")}\n`,
);
await writeFile(resolve(output, ".nojekyll"), "");
console.log(`Built ${paths.length} pages + 404 at ${siteURL.href}`);
