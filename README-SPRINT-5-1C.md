# Sprint 5.1C – Agenda website-weergave definitief

Gebruik alleen de map `pdn-website-v5`.

Fix:
- `/agenda` toont evenementen rechtstreeks uit `/events`.
- Extra fallback toegevoegd via `agenda/index.html`.
- Agenda-overzicht werkt ook als de routerfunctie niet direct pakt.
- Detailpagina blijft werken via `/agenda/<id>` zodra de routerfunctie actief is.

Test:
1. Open `https://pdn-website-v5.info-fematec.workers.dev/agenda`
2. Controleer of de twee gepubliceerde evenementen zichtbaar zijn.
3. Klik op een evenement.
