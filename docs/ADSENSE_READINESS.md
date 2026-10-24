# Préparation AdSense

TAMUSNI ne doit afficher aucune publicité avant validation explicite du site et décision de l’éditeur.

## Configuration centralisée

Le rendu public et l’API utilisent `functions/_lib/ads-config.js`.

- `ADSENSE_CLIENT_ID` contient le Publisher ID public au format `ca-pub-…`. Il alimente la balise d’association et `/ads.txt` ; il n’est jamais dupliqué dans les composants ;
- variable absente ou `ADS_ENABLED=false` : aucun emplacement publicitaire, aucun espace réservé, aucun client AdSense et aucun bandeau publicitaire ne sont rendus ; `/api/ads` ne retourne aucune campagne ;
- `ADS_ENABLED=true` : les deux emplacements manuels prévus peuvent être rendus, mais le client AdSense reste bloqué tant qu’une CMP IAB TCF ne confirme pas le consentement requis.

L’activation future doit se faire dans les variables Cloudflare Pages, seulement après approbation AdSense et validation de la CMP applicable. Elle ne nécessite pas de reconstruire les composants.

La CMP doit être certifiée Google / IAB TCF. `consent.js` ne crée volontairement aucune fausse bannière : il écoute uniquement `__tcfapi`. En l’absence de CMP, après un refus, ou avant une décision, aucune annonce et aucun script `adsbygoogle` ne sont chargés.

## Vérification conservée

La balise `google-adsense-account` est rendue uniquement lorsque `ADSENSE_CLIENT_ID` est configuré dans Cloudflare. `/ads.txt` expose alors le Publisher ID public correspondant. Ces deux éléments n’affichent pas d’annonce et ne chargent pas le script publicitaire.

## Emplacements conservés

L’architecture prévoit un emplacement au milieu de l’accueil et un emplacement dans les articles. Ils ne sont ajoutés au HTML que lorsque l’interrupteur central est actif. Le CSS masque également tout emplacement accidentellement vide.

## Contrôle avant activation

Avant de passer `ADS_ENABLED=true` :

1. confirmer l’approbation AdSense ;
2. configurer une CMP certifiée Google/IAB TCF pour les visiteurs concernés ;
3. vérifier que la CMP expose `__tcfapi`, puis tester accepter, refuser et modifier le consentement ;
4. vérifier qu’aucune annonce ne ressemble à la navigation ou au contenu éditorial ;
5. tester le CLS, le mobile et l’accessibilité.
