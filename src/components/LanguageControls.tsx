"use client";

import { useEffect, useState } from "react";
import { detectLocale, localeLabels, supportedLocales, translations, type Locale } from "@/lib/i18n";

export function LanguageControls() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === "undefined") return "fr";
    const stored = window.localStorage.getItem("tamusni-locale") as Locale | null;
    return stored && supportedLocales.includes(stored) ? stored : detectLocale(navigator.languages);
  });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);
  function choose(next: Locale) { setLocale(next); window.localStorage.setItem("tamusni-locale", next); setOpen(false); window.dispatchEvent(new CustomEvent("tamusni:locale", { detail: next })); }
  return <div className="language-control"><button type="button" className="lang" aria-label={translations[locale].language} aria-expanded={open} onClick={() => setOpen(!open)}>{localeLabels[locale]}</button>{open && <div className="language-menu" role="menu">{supportedLocales.map((item) => <button type="button" role="menuitem" className={item === locale ? "selected" : ""} onClick={() => choose(item)} key={item}>{localeLabels[item]}</button>)}</div>}</div>;
}
