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
3. Créer/configurer Firebase pour Android avec le package `com.abtechnologies.tamusni` et activer Firebase Cloud Messaging. Fournir les valeurs publiques Firebase de l’application au build via `--dart-define=TAMUSNI_FIREBASE_API_KEY=...`, `TAMUSNI_FIREBASE_APP_ID=...`, `TAMUSNI_FIREBASE_SENDER_ID=...`, `TAMUSNI_FIREBASE_PROJECT_ID=...`. Ne jamais ajouter de clé privée de compte de service Firebase dans l’app.
4. Le client demande la permission lors de l’activation dans le profil, enregistre et renouvelle le token sur `/api/push/devices`, traite les messages au premier plan et ouvre l’article ciblé au clic. La désactivation et la déconnexion désactivent le token côté TAMUSNI. La migration D1 `0029_mobile_push_devices.sql` doit être appliquée avant le déploiement de cette API.
5. Pour l’envoi réel, ajouter aux secrets Cloudflare Pages de production `FCM_SERVICE_ACCOUNT_JSON` (JSON du compte de service Firebase) et éventuellement `FCM_PROJECT_ID` (sinon le `project_id` du JSON est utilisé). Le backend utilise OAuth serveur et l’API FCM HTTP v1, respecte `users.notifications_enabled` et les abonnements aux rubriques, et désactive les tokens retournant `UNREGISTERED`. Sans configuration Firebase Android et ces secrets, aucun push de production n’est actif.
6. Tester la chaîne sur un appareil Android avec Google Play Services : autoriser les notifications, publier un article d’une rubrique suivie, puis vérifier premier plan, arrière-plan, app fermée et ouverture de l’article. Les tests unitaires ne remplacent pas ce test réel.
7. L’application utilise le flux Google/Supabase existant avec retour `com.abtechnologies.tamusni://oauth-callback`. Autoriser exactement cette URL dans les redirections Supabase et vérifier le client OAuth Web Google rattaché à Supabase. Tester dans le navigateur Android puis avec un AAB signé ; le client OAuth Android avec SHA-1/SHA-256 ne remplace pas le callback Supabase de ce flux.
8. La publication Play nécessite une clé d’upload conservée hors dépôt, puis les variables d’environnement `TAMUSNI_UPLOAD_STORE_FILE`, `TAMUSNI_UPLOAD_STORE_PASSWORD`, `TAMUSNI_UPLOAD_KEY_ALIAS` et `TAMUSNI_UPLOAD_KEY_PASSWORD`. Aucune clé n’est créée ou versionnée par ce projet.
9. Au 11 octobre 2026, Google Play exige API 36 (Android 16) ou ultérieure pour les nouvelles applications et mises à jour ; vérifier la cible effective du bundle au moment de la soumission.

## Builds

```powershell
flutter build apk --debug
flutter build appbundle --release
```

Le build release utilise uniquement une signature d’upload fournie dans l’environnement. Ne pas distribuer un AAB non signé. L’application n’est pas publiée sur Play Store par ce dépôt.

## Limites à lever avant une annonce « prête pour distribution »

- configuration Google OAuth et Firebase/FCM de production à valider sur des appareils réels ;
- keystore Play et secrets de signature absents du dépôt ;
- tests d’intégration par rôle et parcours hors ligne à exécuter sur émulateur/appareil ;
- le build Android local requiert plusieurs Go libres sur le disque système (Gradle/SDK), au-delà de l’espace actuellement disponible sur la machine qui a lancé ce travail.
