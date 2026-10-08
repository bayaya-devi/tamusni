# TAMUSNI — maintenance hebdomadaire autonome

## Architecture

Le workflow `.github/workflows/weekly-maintenance.yml` s’exécute sur GitHub Actions, indépendamment d’une session Codex. Deux créneaux UTC sont déclarés le dimanche (`02:00` et `03:00`) ; une garde utilisant `Africa/Casablanca` autorise uniquement celui correspondant à 03:00 au Maroc. Cela absorbe le changement d’heure sans lancer deux maintenances complètes. Le workflow peut aussi être déclenché manuellement.

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
- 404 ;
- toutes les URL du sitemap ;
- mesures TTFB, LCP, CLS, poids et débordement ;
- collecte des exceptions JavaScript.

Les tests agressifs, destructifs ou de charge ne sont jamais lancés contre la production.

## Rapport et conservation

`scripts/maintenance/generate_report.py` crée un PDF réel avec ReportLab, nommé `TAMUSNI_Maintenance_YYYY-MM-DD.pdf`. Le PDF, le JSON et les logs sont conservés comme artefact GitHub pendant 90 jours.

Le workflow transmet ensuite le PDF à `/api/maintenance/report`. Cette route Cloudflare exige `MAINTENANCE_RUN_TOKEN`, impose un vrai PDF, fixe le destinataire côté serveur et utilise la clé Brevo déjà protégée dans Cloudflare.

## Secrets GitHub

- `MAINTENANCE_REPORT_TOKEN`
- `TAMUSNI_USER_EMAIL`
- `TAMUSNI_USER_PASSWORD`
- `TAMUSNI_CONTRIBUTOR_EMAIL`
- `TAMUSNI_CONTRIBUTOR_PASSWORD`
- `TAMUSNI_ADMIN_EMAIL`
- `TAMUSNI_ADMIN_PASSWORD`

Le même `MAINTENANCE_REPORT_TOKEN` doit exister dans les secrets du projet Cloudflare Pages. Les clés Brevo et Cloudflare ne sont pas stockées dans GitHub.

## Gestion des anomalies

Les anomalies sont classées P0 à P3. Un P0 ou P1 fait échouer le workflow après la création et l’envoi du rapport, puis ouvre un incident GitHub.

Une CI GitHub classique ne contient pas d’agent Codex autonome capable de comprendre et corriger arbitrairement du code. Le système installé détecte, reproduit, teste, documente et signale les anomalies. Il n’applique pas de correction risquée ni de refonte automatique. Une future correction autonome devra utiliser un agent explicitement autorisé, travailler sur une branche, créer une pull request et conserver une validation humaine pour les opérations sensibles.

## Première exécution et vérification

Après toute modification :

1. déployer les Functions Pages ;
2. déclencher `TAMUSNI weekly maintenance` avec `workflow_dispatch` ;
3. attendre la fin de l’exécution ;
4. télécharger et ouvrir l’artefact PDF ;
5. confirmer la réponse d’envoi Brevo dans les logs ;
6. vérifier la réception dans `aetbconseil@gmail.com` ;
7. observer ensuite au moins une exécution planifiée réelle.
