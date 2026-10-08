# Newsletter hebdomadaire TAMUSNI

## Architecture

D1 est la source de vérité pour le consentement, la langue, les éditions, la sélection et les métriques. Brevo gère les contacts, cinq listes (`FR`, `AR`, `EN`, `ES`, `PT`), les campagnes et la délivrabilité. Le Worker `tamusni-editorial-automation` appelle toutes les quinze minutes l’endpoint Pages protégé. L’endpoint n’agit que le dimanche entre 08:00 et 08:14 en `Africa/Casablanca`.

La clé d’édition `newsletter_YYYY-Www_locale`, le verrou D1 et la conservation de l’identifiant de campagne empêchent un double envoi. Un échec d’une langue ne renvoie pas les langues déjà marquées `SENT`.

## Parcours d’abonnement

- Compte connecté : activation immédiate et synchronisation Brevo.
- Visiteur : intention serveur de 30 minutes, cookie `HttpOnly`, email prérempli, finalisation après connexion ou inscription.
- Le formulaire comprend validation serveur, honeypot et limite de huit intentions par IP et par heure.
- Une suppression de compte met `user_id` à `NULL`; le consentement newsletter reste indépendant. Une désinscription Brevo place l’abonnement en `unsubscribed` via webhook.

## Sélection

La fenêtre couvre le cycle hebdomadaire. Seuls les articles et brèves publics, complets, sourcés et disponibles dans les cinq langues sont éligibles. Le score explicable combine fraîcheur (35), performance réelle (vues, likes, favoris), qualité éditoriale (format, sources, image et résumé), puis applique une légère pénalité aux rubriques répétées. Quatre contenus maximum sont retenus. Un cinquième n’est ajouté que s’il est vérifié et dépasse le seuil exceptionnel de 84.

## Email

Le modèle de référence MJML est dans `emails/weekly-newsletter.mjml`. Le rendu serveur est une colonne fluide de 600 px, basé sur des tables, styles critiques inline, texte alternatif, boutons HTML, version texte et RTL arabe. La matrice Gmail, Outlook, Apple Mail, iOS et Android reste **estimée** tant qu’un test réel sur boîte de réception n’a pas été effectué.

## Brevo et sécurité

Secrets requis : `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `BREVO_WEBHOOK_SECRET` et `NEWSLETTER_RUN_TOKEN`. Ils ne doivent jamais être commités. `mode=setup` crée ou actualise le webhook marketing avec un secret d’en-tête. Les événements sont dédupliqués dans `newsletter_events`.

## Reprise

Les états sont `PREPARING`, `READY`, `SENDING`, `SENT`, `FAILED`, `PARTIAL`, `SKIPPED` et `NO_CONTENT`. Un run relancé récupère la campagne Brevo existante avant toute nouvelle création. Les erreurs temporaires Brevo utilisent un backoff borné. Le tableau de bord admin expose les erreurs de synchronisation et le dernier run.

## Exploitation

Pour un test sans envoi : `POST /api/newsletter/run?force=1&dryRun=1` avec `Authorization: Bearer <NEWSLETTER_RUN_TOKEN>`. Ne jamais utiliser `force=1` sans `dryRun=1` sur la production sauf décision explicite d’envoi.
