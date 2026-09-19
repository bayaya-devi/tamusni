import Link from "next/link";
export default function NotFound() { return <section className="error-page shell"><p className="eyebrow">Erreur 404</p><h1>Cette page n’existe pas.</h1><p>Elle a peut-être été déplacée, archivée ou n’a jamais fait partie de la revue.</p><Link className="primary-button" href="/">Retour à l’accueil</Link></section>; }
