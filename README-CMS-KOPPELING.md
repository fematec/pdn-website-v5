# PDN website v5 - CMS-koppeling fase 1 veilig

Deze build gebruikt de bestaande `pdn-website-v4` layout als basis voor `pdn-website-v5`.

## Belangrijk

- De v4-layout, CSS, HTML-structuur en bestaande afbeeldingen blijven staan.
- Alleen de datalaag in `script.js` is gekoppeld aan het CMS/API.
- Als het CMS of de API tijdelijk niet bereikbaar is, valt de website terug op de bestaande statische data in `data/news.json` en `data/gallery.json`.
- Pagina-inhoud wordt niet hard overschreven door het CMS. Alleen titel, intro en SEO-meta worden veilig bijgewerkt als die beschikbaar zijn.

## Aangepaste bestanden

- `script.js`
- `functions/api/[[path]].js`
- `README-CMS-KOPPELING.md`

## CMS/API route

De publieke website vraagt data op via:

- `/api/settings`
- `/api/menus`
- `/api/pages/{slug}`
- `/api/news`
- `/api/media`

Cloudflare Pages proxy't deze requests via `functions/api/[[path]].js` naar:

`https://pdn-api.info-fematec.workers.dev`

## Upload naar pdn-website-v5

1. Pak deze ZIP uit.
2. Zet de volledige inhoud in de GitHub-repository `fematec/pdn-website-v5`.
3. Commit naar `main` met bijvoorbeeld: `fase 1 cms datalaag v5`.
4. Controleer daarna Cloudflare Pages.

## Testvolgorde

1. Open de homepage.
2. Controleer of de layout hetzelfde is als v4.
3. Open `clubnieuws.html`.
4. Open `fotogalerij.html`.
5. Controleer in DevTools > Network of `/api/news` en `/api/media` worden aangeroepen.

Als de API nog niet bereikbaar is, blijft de website bruikbaar dankzij de fallback.
