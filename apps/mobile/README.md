# TAMUSNI mobile

Application Flutter native (Android V1, iOS target prepared) connectée au même backend Cloudflare Pages et aux mêmes comptes TAMUSNI. L’app n’embarque pas le site dans un WebView ; le WebView n’est utilisé que pour afficher le contrôle Turnstile demandé par le formulaire d’inscription/réinitialisation.

## Développement et vérifications

Depuis `apps/mobile` :

```powershell
flutter pub get
flutter analyze
flutter test
flutter run
```

L’URL API par défaut est `https://tamusni.pages.dev`. Pour un environnement différent, utiliser `--dart-define=TAMUSNI_API_URL=https://...`.

## Rôles et données

- Visiteur : lecture et recherche publiques ; connexion requise pour favoris, mentions « J’aime », profil et notifications personnelles.
- USER : favoris, historique, préférences, newsletter, réglages, notifications et suppression de compte selon les règles du backend.
- CONTRIBUTOR : brouillons et propositions d’articles/brèves, image et source, suivi du statut.
- ADMIN : tableau de bord, revue des propositions, gestion des rôles/ban et création/modification/suppression de contenus.

Les sessions sont conservées dans `flutter_secure_storage`, les données de lecture et actions hors ligne dans SQLite. Le cache est limité aux 30 contenus récents ; l’app n’a ni nouvelle base serveur ni copie des comptes.

## Configuration externe avant distribution

1. Dans Supabase Auth, autoriser les callbacks mobiles : `com.abtechnologies.tamusni://oauth-callback` et `com.abtechnologies.tamusni://password-reset`. Vérifier le callback Supabase déjà utilisé par le site et l’URL de redirection exacte.
2. Pour Google Sign-In, configurer le client Android avec l’identifiant `com.abtechnologies.tamusni` et les empreintes SHA-1/SHA-256 de la signature de développement puis de la clé de publication. Le flux utilise le navigateur système et le retour par lien d’application.
3. Firebase Android est enregistré pour `com.abtechnologies.tamusni`. Le client charge sa configuration publique depuis `android/app/google-services.json` et le plugin Google Services ; aucun `dart-define` Firebase n’est nécessaire sur Android. Ne jamais ajouter de clé privée de compte de service Firebase dans l’app.
4. Le client demande la permission lors de l’activation dans le profil, enregistre et renouvelle le token sur `/api/push/devices`, traite les messages au premier plan et ouvre l’article ciblé au clic. La désactivation et la déconnexion désactivent le token côté TAMUSNI. La migration D1 `0029_mobile_push_devices.sql` doit être appliquée avant le déploiement de cette API.
5. Pour l’envoi réel, ajouter `FCM_SERVICE_ACCOUNT_JSON` (JSON du compte de service Firebase) aux secrets de production des deux exécutions Cloudflare : le projet Pages `tamusni` et le Worker `tamusni-editorial-automation`. Ajouter éventuellement `FCM_PROJECT_ID` (sinon le `project_id` du JSON est utilisé). Les clés ne sont jamais lues côté client. Le backend utilise OAuth serveur et l’API FCM HTTP v1, respecte `users.notifications_enabled` et les abonnements aux rubriques, et désactive les tokens retournant `UNREGISTERED`. Sans configuration Firebase Android et ces secrets, aucun push de production n’est actif.
6. Tester la chaîne sur un appareil Android avec Google Play Services : autoriser les notifications, publier un article d’une rubrique suivie, puis vérifier premier plan, arrière-plan, app fermée et ouverture de l’article. Les tests unitaires ne remplacent pas ce test réel.
7. L’application utilise le flux Google/Supabase existant avec retour `com.abtechnologies.tamusni://oauth-callback`. Autoriser exactement cette URL dans les redirections Supabase et vérifier le client OAuth Web Google rattaché à Supabase. Tester dans le navigateur Android puis avec un AAB signé ; le client OAuth Android avec SHA-1/SHA-256 ne remplace pas le callback Supabase de ce flux.
8. La clé d’upload locale est conservée hors dépôt dans `E:\TamusniBuildCache\secrets\tamusni-upload.jks`. Chargez les variables de signature avec `E:\TamusniBuildCache\secrets\load-signing.ps1` avant un build release. Le mot de passe est protégé par DPAPI pour le compte Windows courant et n’est ni affiché ni versionné. Sauvegardez la clé et son fichier de crédential chiffré dans un coffre sécurisé avant toute publication Play.
9. Au 11 octobre 2026, Google Play exige API 36 (Android 16) ou ultérieure pour les nouvelles applications et mises à jour ; vérifier la cible effective du bundle au moment de la soumission.

## Builds

```powershell
flutter build apk --debug
. 'E:\TamusniBuildCache\secrets\load-signing.ps1'
flutter build appbundle --release --obfuscate --split-debug-info='E:\TamusniBuildCache\symbols'
flutter build apk --release --split-per-abi --obfuscate --split-debug-info='E:\TamusniBuildCache\symbols'
```

Le build release utilise uniquement une signature d’upload fournie dans l’environnement. Ne pas distribuer un AAB non signé. L’application n’est pas publiée sur Play Store par ce dépôt.

## Empreintes de signature à enregistrer

- Debug SHA-1 : `71:05:2D:D4:D2:C3:20:4C:8F:09:77:B7:BA:2F:BB:B8:33:AE:5A:78`
- Debug SHA-256 : `A1:35:C0:10:14:84:F4:BC:59:46:FA:C0:BE:9E:9A:D0:44:FE:BE:9A:94:15:C2:39:AF:E0:DC:F3:FE:E1:FE:83`
- Upload SHA-1 : `91:1D:1F:AB:8A:55:00:33:FD:9C:C8:AB:2E:FF:84:CC:6A:41:DC:C8`
- Upload SHA-256 : `86:88:F8:19:C1:14:4B:37:F9:67:CD:DA:54:42:01:2D:0D:79:4E:01:7E:49:58:E3:72:81:EA:4E:AD:A7:BA:A4`

## Limites à lever avant une annonce « prête pour distribution »

- ajouter les quatre empreintes ci-dessus dans l’application Android Firebase/Google, puis télécharger à nouveau `google-services.json` si Firebase le demande ;
- ajouter `FCM_SERVICE_ACCOUNT_JSON` aux secrets Cloudflare Pages et du Worker éditorial ;
- valider Google OAuth et FCM sur un appareil Android réel ;
- tests d’intégration par rôle et parcours hors ligne à exécuter sur émulateur/appareil ;
- sauvegarder la clé d’upload hors de cette machine avant publication Play.
