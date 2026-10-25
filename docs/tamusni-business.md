# TAMUSNI Business

TAMUSNI Business est séparé du contenu éditorial, des comptes contributeurs et d’AdSense.

## Cycle d’une campagne

1. Un utilisateur authentifié crée un profil entreprise.
2. L’administration vérifie le profil.
3. L’entreprise crée puis soumet une campagne.
4. L’administration approuve ou demande des corrections.
5. Le paiement Stripe ou PayPal devient disponible après approbation.
6. Un webhook signé confirme le paiement. La carte bancaire n’est jamais traitée ni stockée par TAMUSNI.
7. `tamusni-business-automation` active et termine la campagne suivant les dates enregistrées en D1.
8. Les impressions visibles et les clics sont enregistrés avec une clé d’unicité quotidienne puis consolidés.

Le tarif est calculé uniquement côté serveur dans `functions/_lib/business-core.js` : 100 centimes EUR par jour, pour une durée comprise entre 1 et 30 jours.

## Configuration Cloudflare

Variables secrètes Pages requises pour les paiements :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENV` avec la valeur `sandbox` ou `live`

Webhooks de production :

- Stripe : `https://tamusni.science/api/business/payments/stripe-webhook`
- PayPal : `https://tamusni.science/api/business/payments/paypal-webhook`

Événement Stripe requis : `checkout.session.completed`.

Événement PayPal requis : `PAYMENT.CAPTURE.COMPLETED`.

Le composant de diffusion sponsorisée peut être coupé sans supprimer son architecture avec la variable non secrète `BUSINESS_SPONSORSHIP_ENABLED=false`.

## Déploiement

- Le frontend/API reste dans le projet Cloudflare Pages `tamusni`.
- Le planificateur indépendant se déploie avec `wrangler deploy --config business-automation/wrangler.jsonc`.
- La base partagée est D1 `tamusni-production`.

Les campagnes ne deviennent jamais actives avant une validation administrative et une confirmation de paiement signée par le prestataire.
