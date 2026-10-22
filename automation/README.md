# TAMUSNI — automatisations persistantes

Les déclencheurs Cloudflare et GitHub Actions ne sont que des **réveils** : ils ne constituent jamais la preuve qu'un travail a été fait. La table D1 `automation_jobs` est la source de vérité des tâches prévues.

## États

- `pending` : échéance créée, pas encore exécutée ;
- `running` : tentative protégée par un bail limité dans le temps ;
- `retry_pending` : erreur réversible enregistrée, avec une prochaine tentative ;
- `completed` : le résultat a réellement été vérifié ;
- `failed` : réservé à un arrêt explicite nécessitant une décision humaine. Les erreurs techniques ordinaires ne passent pas dans cet état.

Chaque tâche possède une `idempotency_key` unique. Une reprise utilise donc le même job et ne peut pas créer une seconde publication ou une seconde édition. Les baux expirés repassent automatiquement en `retry_pending` lors du prochain réveil.

## Responsabilités des réveils

- `tamusni-editorial-automation` (Cron Cloudflare toutes les 15 minutes) : publications éditoriales ;
- `weekly-newsletter.yml` (GitHub Actions, réveil toutes les 15 minutes) : newsletter ;
- `weekly-maintenance.yml` (GitHub Actions, réveil toutes les 15 minutes) : maintenance.

Chaque tâche a un seul réveil. Les trois processus partagent néanmoins la même table et les mêmes règles de reprise. Les horaires métiers sont calculés avec `Africa/Casablanca`, jamais avec un décalage UTC codé en dur.
