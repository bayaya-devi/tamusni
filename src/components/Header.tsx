import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageControls } from "@/components/LanguageControls";
import { Search } from "@/components/Search";
import { NavigationDrawer } from "@/components/NavigationDrawer";

const categories = ["Innovation", "Intelligence", "Technologies", "Robotique", "Cybersécurité", "Futur", "Espace", "Sciences"];
export async function Header() {
  const session = await getSession();
  const accountHref = session ? session.role === "ADMIN" ? "/admin" : "/compte" : "/connexion";
  const accountLabel = session ? session.role === "ADMIN" ? "Administration" : `Bonjour, ${session.name.split(" ")[0]}` : "Connexion";
  return <header className="site-header"><div className="masthead shell"><Link href="/" className="brand"><span>TAMUSNI</span></Link><div className="masthead-controls"><Search/><LanguageControls/><ThemeToggle/><NavigationDrawer categories={categories} accountHref={accountHref} accountLabel={accountLabel} authenticated={Boolean(session)}/></div></div></header>;
}
