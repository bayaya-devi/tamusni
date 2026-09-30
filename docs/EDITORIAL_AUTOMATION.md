# Automatisation éditoriale TAMUSNI

## Architecture active

`editorial-automation/` est un Worker Cloudflare indépendant de Pages. Il s’exécute toutes les quinze minutes, mais la décision d’agir repose uniquement sur l’heure calculée avec `Africa/Casablanca` via `Intl.DateTimeFormat`. Aucun décalage UTC n’est inscrit en dur.

- À partir du 1er octobre 2026, le Worker prépare un contenu vers 06 h 00 heure du Maroc.
- Le contenu reste en statut `scheduled` jusqu’à 08 h 00, heure du Maroc.
- À partir de 08 h 00, il est publié depuis D1, puis contrôlé publiquement en français, anglais et arabe.
- Les articles sont servis par Pages Functions depuis D1 : une publication n’exige donc pas de redéploiement quotidien du front.

## Source de vérité et reprise

D1 conserve l’état de chaque cycle (`editorial_cycle_state`), les rubriques restantes (`editorial_cycle_categories`), chaque exécution (`editorial_runs`), les candidats consultés, les journaux et les traductions.

Une rubrique n’est marquée terminée qu’après un contrôle public concluant. Une rubrique sans sujet fiable reste donc en attente. S’il n’existe aucun candidat acceptable, l’exécution est enregistrée `no_topic` et le cycle ne progresse pas. En cas d’échec de publication publique, le statut est `content_ready_but_not_public` : il est repris, pas remplacé par une nouvelle publication.

## Qualité et sécurité

Les flux RSS ne servent qu’à découvrir des sujets. Le Worker relit ensuite la page source sélectionnée par HTTPS, limite les requêtes sortantes et refuse les hôtes locaux, privés et de métadonnées. Le contenu externe est balisé comme donnée non fiable dans l’invite IA : il ne peut pas fournir d’instructions au système.

Avant insertion, le résultat doit contenir une fiche factuelle, une source HTTPS réelle et les trois versions complètes. Les titres récents sont comparés à l’historique pour réduire les doublons. Le texte est produit de manière originale et la mention de participation de l’IA est enregistrée dans chaque langue.

## Déploiement initial

1. Appliquer `migrations/0018_editorial_automation.sql` sur D1.
2. Déployer `editorial-automation/` avec Wrangler.
3. Créer le secret Worker `EDITORIAL_RUN_TOKEN`. Il protège uniquement l’URL de test manuel `/run`; la tâche cron n’utilise pas de route publique.
4. Vérifier dans le tableau Cloudflare que le Worker possède les bindings `DB` et `AI`, et que le Cron `*/15 * * * *` est actif.
5. Contrôler les journaux Worker après le premier passage à 06 h 00 puis à 08 h 00 heure du Maroc.

Le Worker ne publie rien avant le 1er octobre 2026. Les secrets ne doivent jamais être ajoutés au dépôt ni au navigateur.
