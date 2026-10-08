# TAMUSNI WATCH — automatisation éditoriale

## Architecture de production

`editorial-automation/` est un Worker Cloudflare autonome. Son Cron s’exécute toutes les quinze minutes en UTC, puis le Worker calcule systématiquement l’heure légale avec `Africa/Casablanca`. Cette fréquence technique absorbe les changements d’heure marocains ; la cadence éditoriale, stockée dans D1, reste strictement de deux jours.

Le jour prévu, TAMUSNI WATCH commence la préparation à partir de 04 h 00. Un contenu validé reste `scheduled` jusqu’à 06 h 00, puis est rendu public depuis D1. Les Pages Functions lisent D1 à chaque requête : une publication éditoriale ne nécessite aucun nouveau build du frontend.

## Cycles

D1 conserve le cycle, son numéro et la date locale de la prochaine publication dans `editorial_cycle_state`. Le cycle initial est `article`. Les rubriques actives sont tirées des sources actives puis conservées dans `editorial_cycle_categories`.

Une rubrique n’est terminée qu’après un contrôle public réussi. Les rubriques sans sujet acceptable restent incomplètes. Lorsque toutes les rubriques sont terminées, le Worker crée le cycle suivant et alterne `article` puis `brief` indéfiniment.

## Veille et contrôle des sources

Les flux RSS servent uniquement à découvrir des sujets. Le Worker :

1. récupère les flux actifs et suit au maximum trois redirections HTTPS contrôlées ;
2. ne retient que les éléments des 72 dernières heures ;
3. élimine les URL déjà utilisées et les titres très similaires ;
4. respecte l’ordre des rubriques en attente, tout en reportant une rubrique sans sujet valable ;
5. relit la page source et ajoute, lorsqu’un titre réellement proche existe, jusqu’à deux sources de recoupement ;
6. limite la sélection coûteuse à sept candidats maximum, répartis entre les rubriques ;
7. traite toute donnée Internet comme non fiable et jamais comme une instruction.

Les sources réellement récupérées sont les seules URL enregistrées et affichées au lecteur. Les URL proposées par un modèle ne sont jamais utilisées.

## Rédaction et QUALITY_GATE

La première passe génère une fiche factuelle avec une source identifiée pour chaque affirmation, puis les versions française, anglaise et arabe depuis cette base unique. Une seconde passe indépendante contrôle : faits, sources, neutralité, qualité éditoriale, français, anglais, arabe et cohérence multilingue.

Les contrôles déterministes imposent également les longueurs minimales, les trois langues, les citations de sources et l’absence de placeholders. Un échec critique empêche l’enregistrement de la publication.

L’auteur public est `TAMUSNI IA`. Chaque traduction contient une mention explicite de l’assistance de l’IA.

## Visuels

Workers AI génère une illustration éditoriale propre au sujet avec `flux-1-schnell`. Le prompt interdit texte, logos, personnes réelles, faux produits et fausse photographie documentaire. L’image JPEG est stockée dans `editorial_media` puis servie par `/media/:key`. Une légende publique précise qu’il s’agit d’une illustration générée par IA.

R2 reste l’évolution recommandée si le service est activé sur le compte Cloudflare. D1 est actuellement utilisé parce que l’API Cloudflare renvoie `R2 not enabled` pour ce compte.

## Reprise et idempotence

`editorial_runs`, `editorial_candidates` et `editorial_logs` conservent les tentatives. Une seule préparation est autorisée par date locale, sauf relance manuelle authentifiée. Un contenu préparé n’est pas remplacé. Si le contrôle public échoue, il repasse en `scheduled` et le Cron retente la publication sans créer de doublon.

Après absence totale de sujet valable, la prochaine tentative est déplacée de deux jours sans terminer les rubriques reportées.

## Journalisation

Les principaux événements sont : `WATCH_STARTED`, `SOURCES_FETCHED`, `CANDIDATES_FOUND`, `DUPLICATES_REMOVED`, `TOPIC_SELECTED`, `FACT_CHECK_STARTED`, `FACT_CHECK_FAILED`, `FACT_CHECK_PASSED`, `CONTENT_GENERATED`, `LANGUAGES_GENERATED`, `IMAGE_READY`, `QUALITY_GATE_PASSED`, `PUBLICATION_CREATED`, `DEPLOYMENT_STARTED`, `DEPLOYMENT_SUCCESS`, `PUBLIC_CHECK_STARTED`, `PUBLIC_CHECK_FAILED` et `PUBLIC_CHECK_SUCCESS`.

Aucun secret n’est inscrit dans les logs.

## Exploitation

- État non sensible : `GET /health` sur le Worker.
- Relance manuelle : `GET /run?mode=prepare&force=1` ou `GET /run?mode=publish&force=1` avec `Authorization: Bearer <EDITORIAL_RUN_TOKEN>`.
- Secrets : exclusivement via les secrets Cloudflare Worker.
- Configuration : `editorial-automation/wrangler.jsonc`.
- Migration : `migrations/0023_editorial_watch.sql`.
