# Sprint 5.2F - Website deploy/router fix

## Gebruik
Vervang alleen `pdn-website-v5`.

## Fix
- `wrangler.jsonc` toegevoegd zodat Cloudflare de bestaande Worker `pdn-website-v5` veilig kan updaten.
- Centrale `worker-site.js` router toegevoegd.
- `/agenda/<id>` wordt nu server-side naar `agenda.html` gerouteerd.
- `/nieuws/<id>` blijft werken.
- Vaste pagina's blijven werken.
- API-proxy via `/api/...` blijft werken.
