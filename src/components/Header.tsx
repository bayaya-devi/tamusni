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
  return <header className="site-header"><div className="masthead shell"><NavigationDrawer categories={categories} accountHref={accountHref} accountLabel={accountLabel}/><Link href="/" className="brand"><span className="brand-star">✦</span><span>TAMUSNI</span></Link><p>Technologies <b>•</b> Sciences <b>•</b> Futur</p></div><nav className="main-nav shell" aria-label="Rubriques">{categories.map((category) => <Link key={category} href={`/rubrique/${category.toLowerCase()}`}>{category}</Link>)}</nav><div className="utility shell"><nav><Link href="/flash">FLASH</Link><Link href="/focus">FOCUS</Link><Link href="/vision">VISION</Link><Link href="/semaine">SEMAINE</Link></nav><div className="utility-account"><Link href={accountHref}>{accountLabel}</Link><Search/><ThemeToggle/><LanguageControls/></div></div></header>;
}
