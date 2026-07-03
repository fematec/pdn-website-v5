# De Prins der Nederlanden Website 2.0

Deze versie gebruikt het uiterlijk van v12/v21, maar heeft extra gratis beheerfuncties via GitHub.

## Wat zit erin

- Statische website voor Cloudflare Pages
- Geen betaalde Cloudflare D1 of R2 nodig
- Beheerpagina: `beheer.html`
- Clubnieuws via `data/news.json`
- Fotogalerij via `data/gallery.json`
- Uploads worden opgeslagen in `uploads/news` en `uploads/gallery`
- Sitemap, robots.txt en favicon

## Upload naar GitHub

1. Pak de ZIP uit.
2. Upload de volledige inhoud van deze map naar je GitHub repository.
3. Controleer dat deze bestanden/mappen zichtbaar zijn:
   - `index.html`
   - `style.css`
   - `script.js`
   - `beheer.html`
   - `beheer.js`
   - `data/news.json`
   - `data/gallery.json`
   - `uploads/news/.gitkeep`
   - `uploads/gallery/.gitkeep`

## Cloudflare instellingen

Framework preset: `None`

Build command: leeg laten

Build output directory: `/`

Root directory: `/`

## Beheer gebruiken

Open na publicatie:

`https://jouwsite.pages.dev/beheer.html`

De beheerpagina vraagt om:

- GitHub gebruikersnaam of organisatie
- Repository naam
- Branch, meestal `main`
- GitHub token

## GitHub token maken

Gebruik bij voorkeur een Fine-grained Personal Access Token:

1. GitHub → Settings
2. Developer settings
3. Personal access tokens
4. Fine-grained tokens
5. Generate new token
6. Selecteer alleen deze repository
7. Permissions:
   - Contents: Read and write
8. Maak token aan en kopieer deze.

Bewaar de token veilig. De website slaat deze alleen lokaal in je browser op.

## Werking

Wanneer je nieuws of foto's toevoegt via `beheer.html`, schrijft de beheerpagina rechtstreeks naar GitHub. Cloudflare ziet daarna de GitHub wijziging en publiceert automatisch opnieuw.

Dit kan enkele seconden tot enkele minuten duren.
