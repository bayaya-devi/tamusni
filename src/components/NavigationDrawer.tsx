"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function NavigationDrawer({ categories, accountHref, accountLabel, authenticated }: { categories: readonly string[]; accountHref: string; accountLabel: string; authenticated: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.classList.toggle("menu-open", open); return () => document.body.classList.remove("menu-open"); }, [open]);
  return <><button type="button" className="menu-toggle" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen(!open)}><span/><span/><span/></button><aside className={`nav-drawer ${open ? "is-open" : ""}`} aria-label="Navigation principale"><div className="drawer-head"><strong>TAMUSNI</strong><button type="button" onClick={() => setOpen(false)}>Fermer</button></div><nav><Link href="/" onClick={() => setOpen(false)}>Accueil</Link>{categories.map((category) => <Link href={`/rubrique/${category.toLowerCase()}`} onClick={() => setOpen(false)} key={category}>{category}</Link>)}</nav><div className="drawer-controls">{authenticated ? <Link href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</Link> : <><Link className="drawer-auth-link" href="/inscription" onClick={() => setOpen(false)}>Inscription</Link><Link className="drawer-auth-link" href="/connexion" onClick={() => setOpen(false)}>Connexion</Link></>}</div></aside>{open && <button type="button" className="drawer-backdrop" aria-label="Fermer le menu" onClick={() => setOpen(false)}/>}</>;
}
