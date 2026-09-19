import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

const categories = ["Innovation", "Intelligence", "Technologies", "Robotique", "Cybersécurité", "Futur", "Espace", "Sciences"];
export async function Header() {
  const session = await getSession();
  return <header className="site-header"><div className="masthead shell"><Link href="/" className="brand"><span className="brand-star">✦</span><span>TAMUSNI</span></Link><p>Technologies <b>•</b> Sciences <b>•</b> Futur</p></div><nav className="main-nav shell" aria-label="Rubriques">{categories.map((category) => <Link key={category} href={`/rubrique/${category.toLowerCase()}`}>{category}</Link>)}</nav><div className="utility shell"><nav><Link href="/flash">FLASH</Link><Link href="/focus">FOCUS</Link><Link href="/vision">VISION</Link><Link href="/semaine">SEMAINE</Link></nav><div className="utility-account">{session ? <Link href={session.role === "ADMIN" ? "/admin" : "/compte"}>{session.role === "ADMIN" ? "Administration" : `Bonjour, ${session.name.split(" ")[0]}`}</Link> : <Link href="/connexion">Connexion</Link>}<span aria-hidden>⌕</span><ThemeToggle/><button className="lang" aria-label="Langue actuelle">FR</button></div></div></header>;
}
