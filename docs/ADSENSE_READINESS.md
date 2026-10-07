# Préparation AdSense

TAMUSNI ne doit afficher aucune publicité avant validation explicite du site et décision de l’éditeur.

## Interrupteur central

Le rendu public et l’API utilisent `functions/_lib/ads-config.js`.

- variable absente ou `ADS_ENABLED=false` : aucun emplacement publicitaire, aucun espace réservé, aucun client AdSense et aucun bandeau publicitaire ne sont rendus ; `/api/ads` ne retourne aucune campagne ;
- `ADS_ENABLED=true` : les emplacements prévus peuvent être rendus et le consentement contrôle le chargement du client AdSense.

L’activation future doit se faire dans les variables Cloudflare Pages, seulement après approbation AdSense et validation de la CMP applicable. Elle ne nécessite pas de reconstruire les composants.

## Vérification conservée

La balise `google-adsense-account` reste dans le `<head>` afin que Google puisse associer le domaine au compte. `/ads.txt` expose le Publisher ID public déjà configuré. Ces deux éléments n’affichent pas d’annonce et ne chargent pas le script publicitaire.

## Emplacements conservés

L’architecture prévoit un emplacement au milieu de l’accueil et un emplacement dans les articles. Ils ne sont ajoutés au HTML que lorsque l’interrupteur central est actif. Le CSS masque également tout emplacement accidentellement vide.

## Contrôle avant activation

Avant de passer `ADS_ENABLED=true` :

1. confirmer l’approbation AdSense ;
2. configurer une CMP certifiée Google si elle est requise pour les visiteurs concernés ;
3. tester accepter, refuser et modifier le consentement ;
4. vérifier qu’aucune annonce ne ressemble à la navigation ou au contenu éditorial ;
5. tester le CLS, le mobile et l’accessibilité.
