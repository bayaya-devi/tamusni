# TAMUSNI — maintenance hebdomadaire autonome

## Architecture

Le workflow `.github/workflows/weekly-maintenance.yml` se réveille toutes les quinze minutes sur GitHub Actions, indépendamment d’une session Codex. Il réclame alors un unique job D1 `weekly_maintenance` dû. Le job est créé pour le dimanche à 06:00 dans `Africa/Casablanca` ; la clé hebdomadaire et le bail D1 empêchent les doublons et permettent la reprise après une panne de GitHub, Brevo ou du réseau. Le workflow peut aussi être déclenché manuellement, sans contourner le job persistant.

La concurrence GitHub empêche deux maintenances simultanées. La durée maximale est de 45 minutes.

## Contrôles

Le script `scripts/maintenance/run.mjs` exécute :

- tests unitaires et d’intégration ;
- typecheck, lint et build ;
- audit des dépendances d’exécution ;
- Playwright contre la production, y compris les rôles lorsque les secrets de test sont présents ;
- routes FR, EN et AR ;
- backend Cloudflare/Supabase ;
- Worker éditorial ;
- état actif du planificateur newsletter indépendant ;
- 404 ;
- toutes les URL du sitemap ;
- mesures TTFB, LCP, CLS, poids et débordement ;
- collecte des exceptions JavaScript.

Les tests agressifs, destructifs ou de charge ne sont jamais lancés contre la production.

## Rapport et conservation

`scripts/maintenance/generate_report.py` crée un PDF réel avec ReportLab, nommé `TAMUSNI_Maintenance_YYYY-MM-DD.pdf`. Le PDF, le JSON et les logs sont conservés comme artefact GitHub pendant 90 jours.

Le workflow transmet ensuite le PDF à `/api/maintenance/report`. Cette route Cloudflare exige `MAINTENANCE_REPORT_TOKEN`, impose un vrai PDF, fixe le destinataire côté serveur et utilise la clé Brevo déjà protégée dans Cloudflare. Si l’audit, le PDF ou l’envoi échoue, le job D1 passe en `retry_pending` avec un délai exponentiel ; il n’est jamais déclaré terminé artificiellement.

## Secrets GitHub

- `MAINTENANCE_REPORT_TOKEN`
- `MAINTENANCE_RUN_TOKEN` (même valeur dans GitHub Actions et Cloudflare Pages)
- `TAMUSNI_USER_EMAIL`
- `TAMUSNI_USER_PASSWORD`
- `TAMUSNI_CONTRIBUTOR_EMAIL`
- `TAMUSNI_CONTRIBUTOR_PASSWORD`
- `TAMUSNI_ADMIN_EMAIL`
- `TAMUSNI_ADMIN_PASSWORD`

Le même `MAINTENANCE_REPORT_TOKEN` doit exister dans les secrets du projet Cloudflare Pages. Les clés Brevo et Cloudflare ne sont pas stockées dans GitHub.

## Coordination des planificateurs

- Maintenance : dimanche à 06:00, heure `Africa/Casablanca`, via GitHub Actions et un job D1 durable.
- Éditorial : Cron Cloudflare toutes les quinze minutes ; préparation à partir de 04:00 et publication à 06:00 uniquement le jour dû.
- Newsletter : dimanche à 06:00 en `Etc/UTC` (GMT+00), via un workflow GitHub distinct.

Chaque système possède un groupe de concurrence ou un verrou D1 propre. La maintenance termine avant la préparation éditoriale ; la newsletter démarre après la fenêtre de publication. Les relances newsletter réutilisent la même clé d’édition et les publications éditoriales réutilisent leur ligne de run afin d’éviter les doublons.

## Gestion des anomalies

Les anomalies sont classées P0 à P3. Un P0 ou P1 fait échouer le workflow après la création et l’envoi du rapport, puis ouvre un incident GitHub.

Une CI GitHub classique ne contient pas d’agent Codex autonome capable de comprendre et corriger arbitrairement du code. Le système installé détecte, reproduit, teste, documente et signale les anomalies. Il n’applique pas de correction risquée ni de refonte automatique. Une future correction autonome devra utiliser un agent explicitement autorisé, travailler sur une branche, créer une pull request et conserver une validation humaine pour les opérations sensibles.

## Première exécution et vérification

Après toute modification :

1. déployer les Functions Pages ;
2. déclencher `TAMUSNI weekly maintenance` avec `workflow_dispatch` ;
3. vérifier que le job D1 passe de `running` à `completed` ou, en cas d’échec, à `retry_pending` ;
4. télécharger et ouvrir l’artefact PDF ;
5. confirmer la réponse d’envoi Brevo dans les logs ;
6. vérifier la réception dans `aetbconseil@gmail.com` ;
7. observer ensuite au moins une exécution planifiée réelle.
