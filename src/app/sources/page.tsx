import { articles } from "@/lib/content";

export default function SourcesPage() {
  const sources = Array.from(new Map(articles.flatMap((article) => article.sources).map((source) => [source.url, source])).values());
  return <section className="text-page shell"><p className="eyebrow">Méthodologie</p><h1>Sources & vérification.</h1><p>Les sources primaires — organismes publics, publications et documentation technique — sont privilégiées. Chaque article publié affiche les références qui soutiennent ses affirmations factuelles.</p><h2>Une distinction nécessaire</h2><p>TAMUSNI distingue les faits confirmés, les déclarations, les estimations, les prévisions, les rumeurs et les opinions. Une source ne transforme pas une interprétation en fait : elle permet au lecteur de la vérifier.</p><h2>Références des premiers dossiers</h2><ul className="source-list">{sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul></section>;
}
