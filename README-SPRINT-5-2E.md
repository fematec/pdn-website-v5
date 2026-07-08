# Sprint 5.2E - Agenda detail rewrite fix

Gebruik alleen de map `pdn-website-v5`.

Fix:
- `_redirects` teruggezet, maar alleen voor detailroutes.
- `/agenda/<id>` wordt intern herschreven naar `agenda.html`.
- `/nieuws/<id>` blijft intern herschreven naar `clubnieuws.html`.
- Geen wildcard rewrite en geen vaste pagina rewrites, zodat `/disciplines`, `/contact`, enz. niet meer in loops komen.
