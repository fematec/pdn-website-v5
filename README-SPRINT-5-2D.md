# Sprint 5.2D - Router loop fix definitief

Gebruik alleen de map `pdn-website-v5`.

## Fix
- `_redirects` verwijderd, omdat deze conflicteerde met de Pages Function router.
- `/disciplines`, `/geschiedenis`, `/contact`, `/agenda` en `/agenda/<id>` worden nu alleen door `functions/[[path]].js` afgehandeld.
- Geen wijziging aan CMS of API.

## Test
- `/`
- `/disciplines`
- `/geschiedenis`
- `/contact`
- `/agenda`
- `/agenda/<id>`
