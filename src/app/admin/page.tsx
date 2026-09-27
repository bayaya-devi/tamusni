import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { newsletterRepository, userRepository } from "@/lib/db";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/connexion");
  const [userCount, newsletterCount] = await Promise.all([userRepository.count(), newsletterRepository.count()]);
  return <section className="admin-page shell"><div className="admin-head"><div><p className="eyebrow">Administration</p><h1>Vue éditoriale</h1></div><form action="/api/auth/logout" method="post"><button className="outline-button">Se déconnecter</button></form></div><div className="dashboard-stats"><div><span>Lecteurs inscrits</span><strong>{userCount}</strong></div><div><span>Newsletter</span><strong>{newsletterCount}</strong></div><div><span>Contenus publiés</span><strong>6</strong></div><div><span>À vérifier</span><strong>0</strong></div></div><div className="admin-grid"><section><h2>Flux éditorial</h2><p>La prochaine version reliera ici la veille, le score TAMUSNI, les sources et les statuts DRAFT, AUTO, REVIEW, BLOCK et PUBLISHED.</p><button className="primary-button">Créer un contenu</button></section><section><h2>Publicité</h2><p>Les emplacements sont déjà réservés sur le site : colonne de Une, après les sections éditoriales et fin d’article. Aucun format intrusif n’est activé.</p><button className="outline-button">Gérer les emplacements</button></section></div></section>;
}
