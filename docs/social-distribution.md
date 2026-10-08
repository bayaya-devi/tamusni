# Diffusion sociale TAMUSNI

La diffusion sociale commence exclusivement après publication d’un contenu TAMUSNI. Les déclencheurs D1 de `migrations/0026_social_distribution.sql` créent une tâche par plateforme et version, sans reprise de l’historique.

## Sécurité et modes

- `SOCIAL_PUBLISHING_MODE=test` (valeur par défaut) prépare la copie, les liens UTM et les médias, puis journalise un `DRY_RUN` sans appeler une plateforme.
- `SOCIAL_PUBLISHING_MODE=live` autorise les appels officiels, uniquement pour les comptes en mode `AUTO` ou pour une action admin explicite en mode `MANUAL`.
- Les jetons restent dans les secrets Cloudflare : `X_USER_ACCESS_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` et `SOCIAL_RUN_TOKEN`.
- `META_GRAPH_API_VERSION` permet de fixer la version Graph API. YouTube reste `PAUSED` et aucun article ou brève ne produit une fausse vidéo.

## Délais et reprise

X est prévu à +5 minutes, Facebook à +15 minutes et Instagram à +30 minutes. Les erreurs 408, 429 et 5xx sont réessayées au maximum quatre fois avec un délai exponentiel borné. Les erreurs d’autorisation, de permission ou de média sont permanentes et visibles dans l’administration.

## Activation contrôlée

1. Connecter chaque compte avec l’API officielle et placer les jetons dans Cloudflare.
2. Vérifier le panneau **Diffusion sociale** en mode test.
3. Garder YouTube en pause.
4. Passer une seule plateforme en `MANUAL`, puis `SOCIAL_PUBLISHING_MODE=live`.
5. Publier manuellement une seule tâche récente et vérifier le résultat public.
6. Passer en `AUTO` seulement après ce contrôle.

Ne jamais automatiser les interfaces web des réseaux sociaux ni stocker leurs mots de passe.

## Références officielles vérifiées

- Meta : [publication de contenu Instagram](https://developers.facebook.com/docs/instagram-platform/content-publishing/) et [publications de Pages Facebook](https://developers.facebook.com/docs/pages-api/posts/).
- X : [création de Posts et médias](https://docs.x.com/x-api/media/quickstart/media-upload-chunked). L’API X est facturée à l’usage ; le coût courant doit être vérifié dans la console développeur avant activation.
- Google : [YouTube Data API — videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert). Les projets API non vérifiés publient les vidéos en privé jusqu’à l’audit Google ; TAMUSNI n’active donc aucun envoi vidéo automatique à ce stade.
