"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { articles } from "@/lib/content";
import { editDistance, normalizeForSearch } from "@/lib/i18n";

function matches(query: string, value: string) {
  const wanted = normalizeForSearch(query); const haystack = normalizeForSearch(value);
  if (!wanted) return true;
  if (haystack.includes(wanted)) return true;
  return wanted.split(" ").every((word) => haystack.split(" ").some((candidate) => candidate.startsWith(word) || (word.length > 3 && editDistance(word, candidate) <= Math.max(1, Math.floor(word.length / 4)))));
}
export function Search() {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); } if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown); }, []);
  const results = useMemo(() => articles.filter((article) => matches(query, `${article.title} ${article.excerpt} ${article.category} ${article.format}`)).slice(0, 7), [query]);
  return <><button type="button" className="search-trigger" onClick={() => setOpen(true)} aria-label="Rechercher">⌕ <span>Rechercher</span><kbd>Ctrl K</kbd></button>{open && <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Recherche"><button type="button" className="search-backdrop" aria-label="Fermer la recherche" onClick={() => setOpen(false)}/><section className="search-panel"><div><label htmlFor="site-search">Rechercher TAMUSNI</label><button type="button" onClick={() => setOpen(false)}>Fermer</button></div><input id="site-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sujet, article, rubrique…"/><p className="search-help">Les fautes légères et les accents sont pris en compte.</p><div className="search-results">{results.length ? results.map((article) => <Link href={`/article/${article.slug}`} onClick={() => setOpen(false)} key={article.slug}><small>{article.category} · {article.format}</small><strong>{article.title}</strong><span>{article.excerpt}</span></Link>) : <p>Aucun résultat. Essayez un autre terme.</p>}</div></section></div>}</>;
}
