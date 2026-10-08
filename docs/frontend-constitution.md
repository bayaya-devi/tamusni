# Constitution du frontend public TAMUSNI

Le contenu éditorial prime sur la décoration. La navigation est constituée d’un en-tête, d’un menu compact et d’un pied de page dans le flux normal. Aucune barre latérale permanente n’est injectée dans les routes publiques localisées.

La source de vérité visuelle du nouveau frontend est `Site web/frontend.css` : bleu nuit `#111A2E`, bleu d’action `#2563EB`, blanc froid `#F8FAFC`, détails argentés `#BFC7D5`. Les familles sont Manrope pour les titres, Inter pour l’interface, Source Serif 4 pour la lecture longue ; les textes arabes utilisent Noto Sans Arabic et Noto Naskh Arabic. Le thème suit exclusivement `prefers-color-scheme`.

Les effets sont courts et discrets : transitions CSS 120–450 ms, reveal déclenché par `IntersectionObserver`, pause des carrousels au survol, au focus et au toucher, désactivation de l’autoplay et des mouvements si `prefers-reduced-motion: reduce`. Le verre translucide est réservé aux éléments flottants ou superposés. Les images sont chargées paresseusement, hormis le premier visuel principal.

Les composants doivent disposer d’un nom accessible, d’un focus visible et de cibles d’au moins 44 px lorsque l’action est tactile. Les données publicitaires ne chargent pas AdSense avant consentement. Les liens sociaux sans destination réelle ne sont pas rendus.

## Frontends fondés sur les rôles

Le frontend public, l’espace utilisateur, l’espace contributeur et l’administration utilisent le même moteur de rendu `layout()` de `functions/_lib/public-frontend.js`. Le header, le logo localisé, le menu compact, le sélecteur de langue, le footer, le thème système, les tokens et le système de mouvement sont donc communs.

- **User** : consultation et espace personnel.
- **Contributor** : base User enrichie de la création, des brouillons, des envois et de l’historique.
- **Admin** : base User enrichie des KPI, comptes, contenus, validations, analyses et newsletter.

`Site web/role-frontend.css` contient seulement les composants professionnels partagés par Contributor et Admin. `admin.css` et `contributor.css` sont limités aux particularités de chaque rôle. Les anciennes coques `site-shell.css/site-shell.js` et la barre latérale ne doivent pas être chargées par les routes protégées modernes.
