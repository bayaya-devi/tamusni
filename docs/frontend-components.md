# Composants du frontend public

Le rendu HTML partagé est dans `functions/_lib/public-frontend.js` ; les traductions d’articles sont dans `public-localization.js`. Les interactions uniques sont dans `Site web/frontend.js`, les tokens et composants visuels dans `Site web/frontend.css`.

- `layout` : en-tête, sélecteur de langue, menu compact, pied de page, bouton de remontée, toast et métadonnées SEO.
- `home` : Une des trois dernières publications, carrousel des six plus lues, autres contenus, publicité intégrée et newsletter.
- `rubric` : titre de rubrique, recherche contextualisée, tri et liste des contenus réels.
- `article` : titre, chapô, visuel, texte, sources externes, vues, like, favoris et partage.
- `authPage` : connexion et inscription ; récupération du mot de passe dans un `<dialog>` natif ; Google via les API OAuth existantes.
- `dashboard` : profil, mot de passe, favoris, historique et suppression de compte.
- `legal` : pages légales localisées avec contact `mailto:`.

Le menu se ferme sur clic extérieur, Échap, sélection ou défilement important. Le dialogue natif retient et restitue le focus. Les carrousels ont des commandes accessibles, une pause et un geste tactile. Les actions réseau réutilisent exclusivement les API Cloudflare Pages existantes.
