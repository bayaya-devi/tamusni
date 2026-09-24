export const supportedLocales = ["fr", "en", "ar"] as const;
export type Locale = (typeof supportedLocales)[number];

export const localeLabels: Record<Locale, string> = { fr: "FR", en: "EN", ar: "ع" };

export const translations = {
  fr: { sections: "Rubriques", flash: "FLASH", focus: "FOCUS", vision: "VISION", week: "SEMAINE", login: "Connexion", account: "Mon compte", admin: "Administration", search: "Rechercher", searchPlaceholder: "Rechercher un sujet, un article, une rubrique…", noResults: "Aucun résultat. Essayez un autre terme.", close: "Fermer", menu: "Ouvrir le menu", language: "Langue", skip: "Aller au contenu" },
  en: { sections: "Sections", flash: "FLASH", focus: "FOCUS", vision: "VISION", week: "WEEKLY", login: "Sign in", account: "My account", admin: "Administration", search: "Search", searchPlaceholder: "Search topics, articles, sections…", noResults: "No results. Try a different term.", close: "Close", menu: "Open menu", language: "Language", skip: "Skip to content" },
  ar: { sections: "الأقسام", flash: "عاجل", focus: "تحليل", vision: "رؤية", week: "الأسبوع", login: "تسجيل الدخول", account: "حسابي", admin: "الإدارة", search: "بحث", searchPlaceholder: "ابحث عن موضوع أو مقال أو قسم…", noResults: "لا توجد نتائج. جرّب عبارة أخرى.", close: "إغلاق", menu: "فتح القائمة", language: "اللغة", skip: "انتقل إلى المحتوى" },
} as const;

export function detectLocale(languages: readonly string[] = []): Locale {
  const match = languages.map((language) => language.toLowerCase().split("-")[0]).find((language): language is Locale => supportedLocales.includes(language as Locale));
  return match ?? "fr";
}

export function normalizeForSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function editDistance(first: string, second: string) {
  const row = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let index = 0; index < first.length; index += 1) {
    let previous = index;
    row[0] = index + 1;
    for (let cursor = 0; cursor < second.length; cursor += 1) {
      const stored = row[cursor + 1];
      row[cursor + 1] = Math.min(row[cursor + 1] + 1, row[cursor] + 1, previous + Number(first[index] !== second[cursor]));
      previous = stored;
    }
  }
  return row[second.length];
}
