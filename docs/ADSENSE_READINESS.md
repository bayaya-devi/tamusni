# Préparation AdSense

TAMUSNI ne doit afficher aucune publicité avant validation explicite du site et décision de l’éditeur.

## Configuration centralisée

Le rendu public et l’API utilisent `functions/_lib/ads-config.js`.

- `ADSENSE_CLIENT_ID` contient le Publisher ID public au format `ca-pub-…`. Il alimente la balise d’association et `/ads.txt` ; il n’est jamais dupliqué dans les composants ;
- variable absente ou `ADS_ENABLED=false` : aucun emplacement publicitaire, aucun espace réservé, aucun client de rendu d'annonces et aucun bandeau publicitaire ne sont rendus ; `/api/ads` ne retourne aucune campagne ;
- `ADS_ENABLED=true` : les deux emplacements manuels prévus peuvent être rendus, mais le client AdSense reste bloqué tant qu’une CMP IAB TCF ne confirme pas le consentement requis.

L’activation future doit se faire dans les variables Cloudflare Pages, seulement après approbation AdSense et validation de la CMP applicable. Elle ne nécessite pas de reconstruire les composants.

La CMP doit être certifiée Google / IAB TCF. `consent.js` ne crée volontairement aucune fausse bannière : il écoute uniquement `__tcfapi`. En l’absence de CMP, après un refus, ou avant une décision, aucune annonce et aucun emplacement AdSense ne sont créés.

## Vérification AdSense

Lorsque `ADSENSE_CLIENT_ID` est configuré dans Cloudflare, les pages éditoriales publiques rendent une seule fois dans leur `<head>` la balise `google-adsense-account` et le script officiel `adsbygoogle.js?client=…` requis par la méthode de vérification AdSense. `/ads.txt` expose le Publisher ID public correspondant.

Ce script de vérification ne crée aucun emplacement, ne réserve aucun espace et n'active pas `ads-client.js`. Les annonces restent désactivées tant que `ADS_ENABLED=false`. Les pages de connexion, d'inscription, de compte, d'administration et de contribution ne reçoivent pas le script.

## Emplacements conservés

L’architecture prévoit un emplacement au milieu de l’accueil et un emplacement dans les articles. Ils ne sont ajoutés au HTML que lorsque l’interrupteur central est actif. Le CSS masque également tout emplacement accidentellement vide.

## Contrôle avant activation

Avant de passer `ADS_ENABLED=true` :

1. confirmer l’approbation AdSense ;
2. configurer une CMP certifiée Google/IAB TCF pour les visiteurs concernés ;
3. vérifier que la CMP expose `__tcfapi`, puis tester accepter, refuser et modifier le consentement ;
4. vérifier qu’aucune annonce ne ressemble à la navigation ou au contenu éditorial ;
5. tester le CLS, le mobile et l’accessibilité.
