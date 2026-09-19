import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Connexion — TAMUSNI" };
export default function ConnectionPage() { return <section className="auth-page shell"><div><p className="eyebrow">Espace TAMUSNI</p><h1>Une même porte d’entrée pour les lecteurs et la rédaction.</h1><p>Les lecteurs peuvent créer gratuitement leur compte. Les administrateurs utilisent cette même page et accèdent automatiquement à leur espace sécurisé selon leurs identifiants.</p></div><AuthForm/></section>; }
