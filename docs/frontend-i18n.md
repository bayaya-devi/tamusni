# Internationalisation publique

Routes : `/fr/`, `/ar/`, `/en/`, `/es/`, `/pt/`. La racine choisit la première langue de `Accept-Language`, sinon le français. La langue est fixée dans le HTML rendu côté serveur (`lang`, `dir`, titres, libellés, métadonnées, canonical et `hreflang`). Le sélecteur reconstruit la même route dans la langue choisie ; aucune substitution de texte dans le DOM n’est utilisée.

Le dictionnaire d’interface et les noms de rubrique se trouvent dans `functions/_lib/public-frontend.js`. Les traductions d’articles FR/EN/AR restent dans `content_translations`. La migration additive `0019_public_locales.sql` crée `content_translations_extra` pour ES/PT sans changer les données historiques. Les traductions manquantes sont produites côté serveur à partir des textes français, puis mises en cache en D1. En cas d’échec, l’interface affiche explicitement que la traduction est en préparation : elle n’affiche pas silencieusement un article français sur une page étrangère.

Après un déploiement neuf, réchauffer les routes ES/PT pour les contenus historiques afin d’éviter qu’un visiteur subisse le coût du premier calcul. Relire éditorialement les traductions automatiques sensibles avant mise en avant.

Les espaces protégés sont disponibles sous `/{locale}/admin/` et `/{locale}/contributeur/` pour FR, AR, EN, ES et PT. Les anciennes routes `/admin/` et `/contributeur/` redirigent vers la langue de la requête. Le changement de langue conserve la route et le rôle. L’arabe utilise le même logo arabe que le public et applique `dir="rtl"` au document, aux listes, formulaires et dialogues.
