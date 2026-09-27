import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { newsletterRepository, userRepository } from "@/lib/db";
import { AdminConsole } from "@/components/AdminConsole";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/connexion");
  const [userCount, newsletterCount] = await Promise.all([userRepository.count(), newsletterRepository.count()]);
  return <section className="admin-page shell"><div className="admin-head"><div><p className="eyebrow">Administration</p><h1>Vue éditoriale</h1></div><form action="/api/auth/logout" method="post"><button className="outline-button">Se déconnecter</button></form></div><div className="dashboard-stats"><div><span>Lecteurs inscrits</span><strong>{userCount}</strong></div><div><span>Newsletter</span><strong>{newsletterCount}</strong></div><div><span>Contenus publiés</span><strong>—</strong></div><div><span>À traiter</span><strong>—</strong></div></div><AdminConsole/></section>;
}
