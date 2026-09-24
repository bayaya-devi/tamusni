import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Inscription — TAMUSNI" };
export default function RegisterPage() { return <section className="auth-page shell"><div><p className="eyebrow">Compte gratuit</p><h1>Rejoindre TAMUSNI.</h1><p>Créez votre compte avec une adresse e-mail et un mot de passe de six caractères minimum.</p></div><AuthForm initialMode="register"/></section>; }
