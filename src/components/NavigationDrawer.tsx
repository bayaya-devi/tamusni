"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageControls } from "@/components/LanguageControls";
import { Search } from "@/components/Search";
import { ThemeToggle } from "@/components/ThemeToggle";

export function NavigationDrawer({ categories, accountHref, accountLabel }: { categories: readonly string[]; accountHref: string; accountLabel: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.classList.toggle("menu-open", open); return () => document.body.classList.remove("menu-open"); }, [open]);
  return <><button type="button" className="menu-toggle" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen(!open)}><span/><span/><span/></button><aside className={`nav-drawer ${open ? "is-open" : ""}`} aria-label="Navigation principale"><div className="drawer-head"><strong>TAMUSNI</strong><button type="button" onClick={() => setOpen(false)}>Fermer</button></div><nav>{categories.map((category) => <Link href={`/rubrique/${category.toLowerCase()}`} onClick={() => setOpen(false)} key={category}>{category}</Link>)}</nav><nav className="drawer-formats"><Link href="/flash" onClick={() => setOpen(false)}>FLASH</Link><Link href="/focus" onClick={() => setOpen(false)}>FOCUS</Link><Link href="/vision" onClick={() => setOpen(false)}>VISION</Link><Link href="/semaine" onClick={() => setOpen(false)}>SEMAINE</Link></nav><div className="drawer-controls"><Link href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</Link><Search/><ThemeToggle/><LanguageControls/></div></aside>{open && <button type="button" className="drawer-backdrop" aria-label="Fermer le menu" onClick={() => setOpen(false)}/>}</>;
}
