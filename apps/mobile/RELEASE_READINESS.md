# TAMUSNI Android — état de préparation V1

Date de vérification : 11 octobre 2026.

## Configuration vérifiée

- package Android : `com.abtechnologies.tamusni` ;
- version : `1.0.0+1` ;
- compileSdk / targetSdk : API 36 ;
- minSdk effectif : API 24 ;
- Firebase Android : `google-services.json` et plugin Google Services présents ;
- stockage de session : `flutter_secure_storage` ;
- cache hors ligne : SQLite, 30 contenus récents, favoris, historique, likes en attente et brouillons contributeur ;
- signature release : clé d’upload RSA 4096 bits hors dépôt ;
- AAB et APK release : signés et obfusqués, symboles conservés hors dépôt.

## Vérifications automatisées

- `flutter analyze --no-pub` : réussi, zéro anomalie ;
- `flutter test --no-pub` : 6 tests réussis ;
- tests backend : 82 tests réussis ;
- ESLint : réussi ;
- TypeScript : réussi ;
- D1 distante : aucune migration en attente ;
- AAB release : build réussi ;
- APK release ARM64 : signature v2 vérifiée avec le certificat TAMUSNI.

## Artefacts

Les binaires et symboles sont stockés dans `E:\TamusniBuildCache` afin de ne pas saturer le disque système :

- `mobile-build\app\outputs\bundle\release\app-release.aab` ;
- `mobile-build\app\outputs\flutter-apk\app-arm64-v8a-release.apk` ;
- `mobile-build\app\outputs\flutter-apk\app-armeabi-v7a-release.apk` ;
- `mobile-build\app\outputs\flutter-apk\app-x86_64-release.apk` ;
- `symbols\` pour la symbolication Flutter.

## Tests humains encore indispensables

Un appareil Android avec Google Play Services reste nécessaire pour valider le consentement aux notifications, la réception FCM en premier plan/arrière-plan/app fermée, Google OAuth, le callback de réinitialisation, l’interface RTL, les téléchargements et les parcours USER/CONTRIBUTOR/ADMIN. Aucun appareil ni image d’émulateur Android n’était disponible pendant cette recette.
