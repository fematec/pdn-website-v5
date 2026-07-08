# Sprint 5.2G - Agenda detail worker-first fix

Deze patch zorgt dat de Worker-router eerst draait voordat Cloudflare Static Assets een 404 geeft.
Daardoor werkt `/agenda/<id>` betrouwbaar.

Aangepast:
- `wrangler.jsonc` met `run_worker_first: true`
- oude Pages `functions/` verwijderd om verwarring te voorkomen
- `_redirects` verwijderd omdat routing nu via `worker-site.js` loopt

Test:
- `/agenda`
- `/agenda/<id>`
- `/disciplines`
- `/contact`
- `/clubnieuws`
