# Sprint 5.2B - Agenda detail URL fix

Gebruik alleen de map `pdn-website-v5`.

Fix:
- `/agenda/<id>` wordt nu door Cloudflare naar `agenda.html` doorgestuurd.
- Agenda-detailpagina's openen daardoor goed vanaf de website/CMS-link.
- `/nieuws/<id>` blijft ook veilig werken.
- Vaste v4-pagina's blijven werken.

Test:
- Open `/agenda`
- Klik op een agenda-item
- Open rechtstreeks `/agenda/<id>`
